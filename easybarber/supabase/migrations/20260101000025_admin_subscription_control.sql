-- Admin manual subscription control + booking enforcement for a
-- suspended subscription.
--
-- Two independent additions on top of the lifecycle machinery built
-- in 20260101000017_subscription_lifecycle.sql:
--
--   1. admin_grant_subscription_access(): lets the platform admin
--      manually extend/reactivate a company's access — e.g. a
--      barbershop owner pays by Pix/WhatsApp outside the (not yet
--      live) automated checkout, and the admin wants to give them a
--      few more days while that payment gets confirmed by hand. This
--      is the ONLY way today for a subscription to reach 'ativa'
--      with a real current_period_end: apply_billing_event() only
--      ever runs from a live payment-provider webhook (not
--      configured yet), and createCheckoutSession() refuses to run
--      without one either.
--
--   2. appointments_require_active_subscription (trigger): until now,
--      subscriptions.status = 'suspensa' had no actual effect — a
--      suspended company could keep booking exactly as before. This
--      blocks new appointment rows (both the owner's own
--      createAppointment() and the public create_public_appointment())
--      while suspended, without touching anything already on the
--      agenda — managing, completing or cancelling an EXISTING
--      appointment still works. Matches the brief: the barbershop
--      keeps access to the platform, it just can't create new
--      bookings until reactivated.

-- ---------------------------------------------------------------------
-- admin_grant_subscription_access: mirrors admin_update_plan_price's
-- pattern (20260101000023_admin_analytics.sql) — pairs a privileged
-- write with its own audit_logs entry in one atomic function, since
-- write_audit_log() itself is never callable directly by a client.
-- ---------------------------------------------------------------------
create or replace function public.admin_grant_subscription_access(p_company_id uuid, p_days int)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription record;
  v_new_period_end date;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can call admin_grant_subscription_access().'
      using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'p_days must be between 1 and 365.' using errcode = '22023';
  end if;

  select * into v_subscription
  from public.subscriptions
  where company_id = p_company_id
  for update;

  if not found then
    raise exception 'Subscription not found for this company.' using errcode = 'P0002';
  end if;

  -- Extends from whichever is later: today, or a current_period_end
  -- that's still in the future — granting days to an already-current
  -- subscription should add to it, never reset it backwards to today.
  v_new_period_end := greatest(coalesce(v_subscription.current_period_end, current_date), current_date) + p_days;

  update public.subscriptions
  set status = 'ativa',
      current_period_end = v_new_period_end,
      grace_period_ends_at = null
  where id = v_subscription.id;

  -- Explicit log, not just the subscriptions_audit_status_change
  -- trigger: that one only fires when status itself changes, so
  -- granting days to an already-'ativa' subscription (no status
  -- change) would otherwise leave no trail at all that an admin did
  -- this by hand.
  perform public.write_audit_log(
    p_company_id, 'admin_granted_subscription_access', 'subscription', v_subscription.id,
    jsonb_build_object(
      'days', p_days,
      'previous_status', v_subscription.status,
      'previous_period_end', v_subscription.current_period_end,
      'new_period_end', v_new_period_end
    )
  );

  return v_new_period_end;
end;
$$;

comment on function public.admin_grant_subscription_access is
  'Admin-only: manually extends a company''s paid-through date by p_days and marks it ativa, for payments confirmed outside the automated flow (e.g. Pix/WhatsApp). Pairs the write with its own audit record, same pattern as admin_update_plan_price.';

revoke all on function public.admin_grant_subscription_access(uuid, int) from public;
grant execute on function public.admin_grant_subscription_access(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- Enforcement: a suspended subscription can no longer create new
-- appointments. company_id is set on every appointments INSERT
-- (both call sites already set it), so this needs no new parameter
-- threading through either createAppointment() or
-- create_public_appointment() — one trigger covers both, and any
-- future third way of inserting an appointment too.
-- ---------------------------------------------------------------------
create or replace function public.check_company_subscription_active()
returns trigger
language plpgsql
as $$
declare
  v_status public.subscription_status;
begin
  select status into v_status
  from public.subscriptions
  where company_id = new.company_id;

  if v_status = 'suspensa' then
    raise exception 'Esta barbearia está com o acesso suspenso por falta de pagamento. Novos agendamentos ficam bloqueados até a reativação.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.check_company_subscription_active is
  'Blocks new appointment rows for a suspended subscription. Fires only on INSERT, so an existing appointment stays fully manageable (reschedule, complete, cancel) while suspended — only creating a NEW one is blocked.';

create trigger appointments_require_active_subscription
  before insert on public.appointments
  for each row execute function public.check_company_subscription_active();
