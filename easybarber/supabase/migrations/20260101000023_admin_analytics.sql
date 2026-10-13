-- Platform-owner analytics: a third, more restricted vantage point on
-- top of the two that already exist (a barbershop owner managing
-- their own company; a visitor booking through the public page). The
-- platform admin needs cross-company numbers (bookings, WhatsApp
-- sends, subscriptions, revenue) to make product/business decisions —
-- never raw access to any one company's customers or appointments
-- (see the design-rules comment at the top of
-- 20260101000010_rls_policies.sql: admin gets row access only to
-- platform-operational tables, everything else is aggregate counts
-- through a security definer function). This migration keeps that
-- rule: a new whatsapp_messages log table with NO policies at all
-- (nobody queries it directly, not even the admin), and every number
-- the admin screen shows comes from admin_company_overview() /
-- admin_platform_metrics() / admin_revenue_timeseries() below.

-- ---------------------------------------------------------------------
-- whatsapp_messages: one row per attempted send (sent or failed),
-- logged by log_whatsapp_message() right after
-- sendBookingConfirmation() calls the provider (src/lib/actions/public-booking.ts).
-- This is what "quantas mensagens cada barbearia envia" and the
-- future per-message billing counter (R$0,10/mensagem — deferred
-- until the owner activates a paid Twilio plan) both read from.
-- cost_cents is stored per row (not computed later) so the number
-- never depends on whatever the price happens to be today.
-- ---------------------------------------------------------------------
create type public.whatsapp_message_status as enum ('sent', 'failed');

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  status public.whatsapp_message_status not null,
  provider text not null,
  provider_message_id text,
  error text,
  cost_cents int not null default 10 check (cost_cents >= 0),
  created_at timestamptz not null default now()
);

comment on table public.whatsapp_messages is
  'Append-only log of attempted WhatsApp sends (sent or failed), one row per attempt. No RLS policies — not even the admin reads this table directly, only through admin_company_overview()/admin_platform_metrics() below. Written exclusively through log_whatsapp_message().';

create index whatsapp_messages_company_id_created_at_idx
  on public.whatsapp_messages (company_id, created_at);

alter table public.whatsapp_messages enable row level security;
-- Deliberately no policies: RLS enabled with zero policies means no
-- role (anon, authenticated) can read or write a row directly — the
-- table is reachable only through the security definer function
-- below (which runs as its owner, bypassing RLS) and from trusted
-- server contexts.

-- ---------------------------------------------------------------------
-- log_whatsapp_message: the only way a row lands in whatsapp_messages.
-- Takes just the appointment id and derives company_id itself rather
-- than trusting a second, independently-spoofable parameter — the
-- caller (sendBookingConfirmation) already has a server-confirmed
-- appointment id from create_public_appointment()'s own return value.
-- Best-effort by design: an appointment that somehow doesn't exist
-- just means nothing gets logged, never an error that could surface
-- back to the booking flow this runs after.
--
-- Restricted to service_role (same pattern as apply_billing_event() in
-- 20260101000017_subscription_lifecycle.sql), NOT granted to
-- anon/authenticated: this is bookkeeping for a send that already
-- happened, not something a visitor's own request should ever be able
-- to trigger directly. Granting it broadly would let anyone holding
-- the public anon key call it straight from Supabase's REST API with
-- any real appointment id (e.g. one they received in a WhatsApp
-- message or cancel link) and inject fake cost into that company's
-- totals — the derive-company_id-server-side defense above stops a
-- cross-company row, not a cross-company cost-inflation spam.
-- ---------------------------------------------------------------------
create or replace function public.log_whatsapp_message(
  p_appointment_id uuid,
  p_status public.whatsapp_message_status,
  p_provider text,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
  from public.appointments
  where id = p_appointment_id;

  if v_company_id is null then
    return;
  end if;

  insert into public.whatsapp_messages (
    company_id, appointment_id, status, provider, provider_message_id, error
  )
  values (
    v_company_id, p_appointment_id, p_status, p_provider, p_provider_message_id, p_error
  );
end;
$$;

comment on function public.log_whatsapp_message is
  'The only way a row is written to whatsapp_messages. Called right after every WhatsApp send attempt (success or failure) — see sendBookingConfirmation() in src/lib/actions/public-booking.ts.';

revoke all on function public.log_whatsapp_message(uuid, public.whatsapp_message_status, text, text, text) from public;
grant execute on function public.log_whatsapp_message(uuid, public.whatsapp_message_status, text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- admin_company_overview: extends the version from
-- 20260101000011_admin_overview.sql with appointment counts, WhatsApp
-- send counts/cost, and the plan's price (so the admin screen doesn't
-- need a second round trip against plans to show "quais os valores").
-- Still only ever counts — never returns a customer name, appointment
-- time, or message body.
-- ---------------------------------------------------------------------
drop function if exists public.admin_company_overview();

create function public.admin_company_overview()
returns table (
  company_id uuid,
  company_name text,
  plan_name text,
  plan_price_cents int,
  subscription_status public.subscription_status,
  professional_count bigint,
  customer_count bigint,
  next_payment_date date,
  appointment_count bigint,
  appointments_this_month bigint,
  whatsapp_message_count bigint,
  whatsapp_messages_this_month bigint,
  whatsapp_cost_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can call admin_company_overview().'
      using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    p.name,
    p.price_cents,
    s.status,
    (select count(*) from public.professionals pr where pr.company_id = c.id and pr.active),
    (select count(*) from public.customers cu where cu.company_id = c.id),
    s.current_period_end,
    (select count(*) from public.appointments a where a.company_id = c.id),
    (select count(*) from public.appointments a
       where a.company_id = c.id
         and date_trunc('month', a.starts_at at time zone public.app_timezone())
           = date_trunc('month', now() at time zone public.app_timezone())),
    (select count(*) from public.whatsapp_messages w where w.company_id = c.id),
    (select count(*) from public.whatsapp_messages w
       where w.company_id = c.id
         and date_trunc('month', w.created_at at time zone public.app_timezone())
           = date_trunc('month', now() at time zone public.app_timezone())),
    (select coalesce(sum(w.cost_cents), 0) from public.whatsapp_messages w where w.company_id = c.id)
  from public.companies c
  left join public.subscriptions s on s.company_id = c.id
  left join public.plans p on p.id = s.plan_id
  order by c.created_at desc;
end;
$$;

comment on function public.admin_company_overview is
  'Admin-only aggregated company list (counts, not raw rows) for the platform admin panel.';

revoke all on function public.admin_company_overview() from public;
grant execute on function public.admin_company_overview() to authenticated;

-- ---------------------------------------------------------------------
-- admin_platform_metrics: extends the version from
-- 20260101000011_admin_overview.sql with platform-wide appointment
-- and WhatsApp totals, for the dashboard's header stat cards.
-- ---------------------------------------------------------------------
drop function if exists public.admin_platform_metrics();

create function public.admin_platform_metrics()
returns table (
  total_companies bigint,
  active_companies bigint,
  mrr_cents bigint,
  new_companies_this_month bigint,
  total_appointments bigint,
  appointments_this_month bigint,
  total_whatsapp_messages bigint,
  whatsapp_cost_cents_this_month bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can call admin_platform_metrics().'
      using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.companies),
    (select count(*) from public.subscriptions where status = 'ativa'),
    (select coalesce(sum(p.price_cents), 0)
       from public.subscriptions s
       join public.plans p on p.id = s.plan_id
       where s.status = 'ativa'),
    (select count(*) from public.companies
       where date_trunc('month', created_at) = date_trunc('month', now())),
    (select count(*) from public.appointments),
    (select count(*) from public.appointments a
       where date_trunc('month', a.starts_at at time zone public.app_timezone())
         = date_trunc('month', now() at time zone public.app_timezone())),
    (select count(*) from public.whatsapp_messages),
    (select coalesce(sum(w.cost_cents), 0) from public.whatsapp_messages w
       where date_trunc('month', w.created_at at time zone public.app_timezone())
         = date_trunc('month', now() at time zone public.app_timezone()));
end;
$$;

comment on function public.admin_platform_metrics is
  'Admin-only aggregated platform metrics for the admin dashboard header cards.';

revoke all on function public.admin_platform_metrics() from public;
grant execute on function public.admin_platform_metrics() to authenticated;

-- ---------------------------------------------------------------------
-- admin_revenue_timeseries: monthly revenue for the cash-flow chart —
-- sums amount_cents from billing_events where event_type =
-- 'payment_confirmed', the one canonical marker (see
-- apply_billing_event() in 20260101000017_subscription_lifecycle.sql)
-- that actual money was received. Months with zero revenue are
-- included (via generate_series) so the chart never silently skips a
-- quiet month.
-- ---------------------------------------------------------------------
create or replace function public.admin_revenue_timeseries(p_months int default 12)
returns table (
  month date,
  revenue_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can call admin_revenue_timeseries().'
      using errcode = '42501';
  end if;

  if p_months is null or p_months <= 0 or p_months > 60 then
    raise exception 'p_months must be between 1 and 60.' using errcode = '22023';
  end if;

  return query
  select
    gs.month::date,
    coalesce(sum(be.amount_cents), 0)
  from generate_series(
    date_trunc('month', now() at time zone public.app_timezone()) - make_interval(months => p_months - 1),
    date_trunc('month', now() at time zone public.app_timezone()),
    interval '1 month'
  ) as gs(month)
  left join public.billing_events be
    on be.event_type = 'payment_confirmed'
    and date_trunc('month', be.created_at at time zone public.app_timezone()) = gs.month
  group by gs.month
  order by gs.month;
end;
$$;

comment on function public.admin_revenue_timeseries is
  'Admin-only monthly revenue series (confirmed payments only) for the cash-flow chart.';

revoke all on function public.admin_revenue_timeseries(int) from public;
grant execute on function public.admin_revenue_timeseries(int) to authenticated;

-- ---------------------------------------------------------------------
-- admin_update_plan_price: the plans_write RLS policy already lets an
-- admin UPDATE plans directly, but write_audit_log() itself is never
-- granted to authenticated (only ever called from inside another
-- security definer function, everywhere else in this schema) — a bare
-- client-side `.update()` would change the price with no audit trail.
-- This wraps the same update with the log entry, mirroring how every
-- other privileged write in this schema pairs the write with its own
-- audit record in one atomic function rather than two round trips.
-- ---------------------------------------------------------------------
create or replace function public.admin_update_plan_price(p_plan_id uuid, p_price_cents int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can call admin_update_plan_price().'
      using errcode = '42501';
  end if;
  if p_price_cents is null or p_price_cents < 0 then
    raise exception 'p_price_cents must be a non-negative integer.' using errcode = '22023';
  end if;

  update public.plans set price_cents = p_price_cents
  where id = p_plan_id
  returning name into v_plan_name;

  if v_plan_name is null then
    raise exception 'Plan not found.' using errcode = 'P0002';
  end if;

  perform public.write_audit_log(
    null, 'plan_price_updated', 'plan', p_plan_id,
    jsonb_build_object('plan_name', v_plan_name, 'new_price_cents', p_price_cents)
  );
end;
$$;

comment on function public.admin_update_plan_price is
  'Admin-only: updates a plan''s price and writes the audit log entry atomically (write_audit_log() itself is never reachable directly from a client).';

revoke all on function public.admin_update_plan_price(uuid, int) from public;
grant execute on function public.admin_update_plan_price(uuid, int) to authenticated;
