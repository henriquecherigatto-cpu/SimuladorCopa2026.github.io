-- Two unrelated additions requested together:
--
--   1. The automated WhatsApp booking-confirmation (sent to the
--      CUSTOMER) becomes a Profissional-tier (R$49,90) perk — not
--      included on Essencial (R$24,90). plans.whatsapp_confirmations_included
--      is the machine-checkable flag; the existing `features` jsonb
--      array stays pure marketing copy (both plans still list
--      "Suporte via WhatsApp" there, which is the UNRELATED
--      platform-support line — see SupportWhatsAppButton — not this).
--
--   2. log_whatsapp_message() gets a second way to say which company a
--      send belongs to: p_company_id, for a send that isn't tied to
--      any appointment at all (the new subscription grace-period
--      reminder sent to the BARBERSHOP itself — see
--      src/lib/actions/subscription-notifications.ts). Dropped and
--      recreated rather than CREATE OR REPLACE because adding a
--      parameter changes the function's signature — see
--      admin_company_overview() in 20260101000023_admin_analytics.sql
--      for the same reasoning. whatsapp_messages.appointment_id was
--      already nullable, so no table change is needed, only the
--      function.

alter table public.plans
  add column whatsapp_confirmations_included boolean not null default true;

comment on column public.plans.whatsapp_confirmations_included is
  'Whether a booking made through this plan''s companies triggers the automated WhatsApp confirmation to the CUSTOMER (sendBookingConfirmation() in src/lib/actions/public-booking.ts). A commercial differentiator, independent of "Suporte via WhatsApp" in the features column (platform support to the barbershop owner).';

update public.plans
set whatsapp_confirmations_included = false
where name = 'Essencial';

-- ---------------------------------------------------------------------
-- log_whatsapp_message: drop + recreate with the new optional
-- p_company_id parameter (used when p_appointment_id is null).
-- ---------------------------------------------------------------------
drop function if exists public.log_whatsapp_message(uuid, public.whatsapp_message_status, text, text, text);

create function public.log_whatsapp_message(
  p_status public.whatsapp_message_status,
  p_provider text,
  p_appointment_id uuid default null,
  p_company_id uuid default null,
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
  if p_appointment_id is not null then
    select company_id into v_company_id
    from public.appointments
    where id = p_appointment_id;
  else
    v_company_id := p_company_id;
  end if;

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
  'The only way a row is written to whatsapp_messages. Called right after every WhatsApp send attempt (success or failure) — either with p_appointment_id (sendBookingConfirmation(), company derived from the appointment) or p_company_id directly (notifyCompanyEnteringGracePeriod() in src/lib/actions/subscription-notifications.ts — a send with no appointment behind it).';

revoke all on function public.log_whatsapp_message(public.whatsapp_message_status, text, uuid, uuid, text, text) from public;
grant execute on function public.log_whatsapp_message(public.whatsapp_message_status, text, uuid, uuid, text, text) to service_role;
