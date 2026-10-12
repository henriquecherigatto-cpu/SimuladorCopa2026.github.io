-- Subscription lifecycle state machine: vencimento (due date) →
-- tolerância (grace period) → suspensão (suspension) → reativação
-- (reactivation), driven only by two SECURITY DEFINER entry points,
-- both locked to service_role:
--
--   * public.apply_billing_event(...)       — called once per
--     verified payment-provider webhook event (or, in tests, a
--     simulated event explicitly marked as such). Idempotent: the
--     same provider_event_id can be delivered any number of times
--     (at-least-once webhook delivery) without double-processing.
--
--   * public.sweep_subscription_lifecycle() — called on a schedule
--     (pg_cron, or an external scheduler hitting a secured route) to
--     catch the cases no webhook announces on its own: a renewal date
--     that simply passed with no payment, or a grace period that ran
--     out. This is what actually enforces "dez dias de tolerância" —
--     a provider tells us a charge is overdue, but nothing tells us
--     "10 days have now elapsed" except checking the clock ourselves.
--
-- Neither function is reachable by `authenticated` or `anon` — see
-- the REVOKE/GRANT block at the end. A client can read its own
-- subscription row (subscriptions_select policy) but has no path,
-- direct or indirect, to writing 'ativa' into it. That is the
-- concrete meaning of "não confiar no navegador para confirmar
-- pagamentos": the browser can only ever ask for a checkout session
-- (see the billing Server Actions) and observe the status column —
-- it can never set it.
--
-- State machine (public.subscription_status, defined in
-- 20260101000007_plans_subscriptions_billing.sql):
--
--   pendente ──payment_confirmed──────────────────────┐
--      │                                               ▼
--      │                                            ativa ◄──────────┐
--      │                                               │ due date    │
--      │                                               │ passes      │ payment_confirmed
--      │                                               ▼             │
--      │                                         tolerancia ─────────┤
--      │                                               │ grace period│
--      │                                               │ elapses     │
--      │                                               ▼             │
--      │                                          suspensa ──────────┘
--      │
--      └──subscription_canceled──► cancelada (terminal; any status)
--
-- payment_overdue moves ativa → tolerancia immediately, for providers
-- that proactively announce it; the sweep is the fallback (and the
-- only mechanism at all) for providers that don't.

-- ---------------------------------------------------------------------
-- apply_billing_event: process one (provider, provider_event_id) exactly
-- once, updating the subscription according to the event's canonical
-- type. p_event_type is the app's own small vocabulary — the TypeScript
-- provider adapter (e.g. src/lib/billing/asaas.ts) is what maps a real
-- payment provider's event names onto it, so this function never has to
-- know about any specific provider's webhook schema.
-- ---------------------------------------------------------------------
create or replace function public.apply_billing_event(
  p_provider text,
  p_provider_event_id text,
  p_company_id uuid,
  p_event_type text,
  p_amount_cents int,
  p_status text,
  p_raw_payload jsonb default '{}'::jsonb,
  p_new_period_end date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_subscription record;
  v_old_status public.subscription_status;
  v_new_status public.subscription_status;
begin
  if p_provider is null or btrim(p_provider) = '' then
    raise exception 'provider is required' using errcode = '22023';
  end if;
  if p_provider_event_id is null or btrim(p_provider_event_id) = '' then
    raise exception 'provider_event_id is required' using errcode = '22023';
  end if;

  -- Idempotency gate: if this exact provider event was already
  -- recorded, do nothing further. At-least-once webhook delivery
  -- means the same event can arrive twice; this is what makes a
  -- replay a safe no-op instead of a double-applied transition.
  insert into public.billing_events (
    company_id, provider, provider_event_id, event_type, amount_cents, status, raw_payload
  )
  values (
    p_company_id, p_provider, p_provider_event_id, p_event_type, p_amount_cents, p_status, p_raw_payload
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('duplicate', true);
  end if;

  select * into v_subscription
  from public.subscriptions
  where company_id = p_company_id
  for update;

  if not found then
    -- Still a logged event (useful for audit/debugging), just one
    -- that can't be applied to a state machine that doesn't exist.
    update public.billing_events set processed_at = now() where id = v_event_id;
    return jsonb_build_object('duplicate', false, 'applied', false, 'reason', 'no subscription for company');
  end if;

  v_old_status := v_subscription.status;
  v_new_status := v_old_status;

  case p_event_type
    when 'payment_confirmed' then
      -- Reactivation (from tolerancia/suspensa) and the ordinary
      -- renewal (from ativa) are the same transition: a confirmed
      -- payment always means "fully current," regardless of which
      -- non-terminal state it came from. A cancelled subscription
      -- does NOT reactivate on its own — that would let a stray/
      -- delayed payment event silently undo an explicit cancellation.
      if v_old_status <> 'cancelada' then
        v_new_status := 'ativa';
        update public.subscriptions
        set status = v_new_status,
            current_period_end = coalesce(p_new_period_end, greatest(current_period_end, current_date) + interval '1 month'),
            grace_period_ends_at = null
        where id = v_subscription.id;
      end if;

    when 'payment_overdue' then
      -- Only a currently-active subscription can become overdue.
      -- Already-tolerancia/suspensa/pendente/cancelada are left alone
      -- so a duplicate or out-of-order "overdue" notification can
      -- never reset a grace-period clock that's already running.
      if v_old_status = 'ativa' then
        v_new_status := 'tolerancia';
        update public.subscriptions
        set status = v_new_status,
            grace_period_ends_at = coalesce(v_subscription.current_period_end, current_date) + v_subscription.grace_period_days
        where id = v_subscription.id;
      end if;

    when 'subscription_canceled' then
      if v_old_status <> 'cancelada' then
        v_new_status := 'cancelada';
        update public.subscriptions
        set status = v_new_status,
            canceled_at = now()
        where id = v_subscription.id;
      end if;

    else
      -- Unrecognized event type (e.g. an invoice-created notice the
      -- state machine doesn't act on): log it and move on. Silently
      -- ignoring unknown event types — rather than erroring — is what
      -- lets the provider add new webhook events without breaking
      -- this handler.
      null;
  end case;

  update public.billing_events set processed_at = now() where id = v_event_id;

  -- No explicit write_audit_log() call here: the
  -- subscriptions_audit_status_change trigger (20260101000008) already
  -- fires on every UPDATE above that actually changes status, logging
  -- 'subscription_status_changed' with the same {from, to} shape. A
  -- second call here would double-log every transition.

  return jsonb_build_object(
    'duplicate', false, 'applied', true,
    'old_status', v_old_status, 'new_status', v_new_status
  );
end;
$$;

comment on function public.apply_billing_event is
  'The ONLY way subscriptions.status ever changes in response to a payment event. Idempotent on (provider, provider_event_id). Restricted to service_role — see REVOKE/GRANT below.';

-- ---------------------------------------------------------------------
-- sweep_subscription_lifecycle: date-driven half of the state machine.
-- Run this on a schedule (daily is enough for a 10-day grace period,
-- but it's safe to run more often — every call is idempotent since it
-- only acts on rows whose date columns say they're actually due).
-- ---------------------------------------------------------------------
create or replace function public.sweep_subscription_lifecycle()
returns table (company_id uuid, old_status public.subscription_status, new_status public.subscription_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  -- Phase 1: ativa → tolerancia for anything whose paid period has
  -- ended with no renewal recorded.
  for v_row in
    update public.subscriptions
    set status = 'tolerancia',
        grace_period_ends_at = current_period_end + grace_period_days
    where status = 'ativa'
      and current_period_end is not null
      and current_period_end < current_date
    returning subscriptions.company_id, subscriptions.id
  loop
    -- subscriptions_audit_status_change (trigger) already logs this
    -- transition; see the comment in apply_billing_event above.
    company_id := v_row.company_id;
    old_status := 'ativa';
    new_status := 'tolerancia';
    return next;
  end loop;

  -- Phase 2: tolerancia → suspensa once the grace period itself has
  -- run out. Separate loop (not combined with phase 1) so a
  -- subscription that becomes overdue today doesn't also get swept
  -- straight to suspended in the same pass.
  for v_row in
    update public.subscriptions
    set status = 'suspensa'
    where status = 'tolerancia'
      and grace_period_ends_at is not null
      and grace_period_ends_at < current_date
    returning subscriptions.company_id, subscriptions.id
  loop
    company_id := v_row.company_id;
    old_status := 'tolerancia';
    new_status := 'suspensa';
    return next;
  end loop;

  return;
end;
$$;

comment on function public.sweep_subscription_lifecycle is
  'Date-driven half of the subscription state machine: ativa→tolerancia when current_period_end passes, tolerancia→suspensa when grace_period_ends_at passes. Call on a schedule (pg_cron or an external scheduler hitting a secured route). Restricted to service_role.';

-- ---------------------------------------------------------------------
-- Lock both functions to service_role only. Postgres grants EXECUTE on
-- a new function to PUBLIC by default, which would otherwise let
-- `authenticated` (and even `anon`) call these directly — the single
-- most important line in this file for "não confiar no navegador para
-- confirmar pagamentos": without this REVOKE, any signed-in owner
-- could call apply_billing_event(..., 'payment_confirmed', ...) on
-- their own company and grant themselves a paid subscription for
-- free. service_role (used only by the webhook/sweep server routes,
-- never shipped to the browser) already bypasses RLS entirely, so
-- SECURITY DEFINER here is defense in depth / search_path hygiene
-- rather than what makes the write possible.
-- ---------------------------------------------------------------------
revoke all on function public.apply_billing_event(text, text, uuid, text, int, text, jsonb, date) from public;
revoke all on function public.sweep_subscription_lifecycle() from public;

grant execute on function public.apply_billing_event(text, text, uuid, text, int, text, jsonb, date) to service_role;
grant execute on function public.sweep_subscription_lifecycle() to service_role;
