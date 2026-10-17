-- The WhatsApp booking-confirmation send (sendBookingConfirmation() in
-- src/lib/actions/public-booking.ts) only ever checked the company's
-- PLAN (plans.whatsapp_confirmations_included), never its subscription
-- STATUS. A company on the Profissional plan whose subscription is
-- pendente (never paid) or cancelada still passed that check — the
-- only existing DB-level guard, check_company_subscription_active()
-- (20260101000025_admin_subscription_control.sql), blocks new
-- APPOINTMENTS for status = 'suspensa' only, so it doesn't close this
-- gap either. This is the backend fix for that: the full eligibility
-- rule (right plan AND an actually active subscription) now lives in
-- one function, the single place every future call site should ask
-- "can this company get an automated WhatsApp confirmation right
-- now" — same reasoning as every other privileged check in this
-- schema living in the database, not scattered app code.
--
-- Takes an appointment id, not a company id — derives company_id
-- itself via the join, the same defense log_whatsapp_message() already
-- uses (20260101000023_admin_analytics.sql): the caller never gets to
-- hand in a company id that didn't come from a server-trusted row.
--
-- security definer, same as log_whatsapp_message(): service_role
-- bypasses RLS on its own, but RLS-bypass isn't the same as holding
-- the base table grants this join needs (appointments/subscriptions/
-- plans are only explicitly granted to authenticated — see
-- 20260101000014_grants.sql) — security definer runs as this
-- function's owner instead, sidestepping that entirely. Granted to
-- service_role only, same as log_whatsapp_message().
create or replace function public.whatsapp_confirmation_allowed(p_appointment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    join public.subscriptions s on s.company_id = a.company_id
    join public.plans p on p.id = s.plan_id
    where a.id = p_appointment_id
      and s.status = 'ativa'
      and p.whatsapp_confirmations_included
  );
$$;

comment on function public.whatsapp_confirmation_allowed is
  'True only when the appointment''s company is on a plan that includes WhatsApp confirmations AND its subscription is currently ativa. Derives company_id from the appointment row itself (never a client-supplied company id). Any missing row anywhere in the join (no such appointment, no subscription, no plan) correctly falls through to false via exists() — there is no path that resolves missing data to true.';

revoke all on function public.whatsapp_confirmation_allowed(uuid) from public;
grant execute on function public.whatsapp_confirmation_allowed(uuid) to service_role;
