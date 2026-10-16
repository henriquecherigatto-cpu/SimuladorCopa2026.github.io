-- Two changes to "Consultar meu agendamento" (/agendar/<slug>, the
-- phone-number lookup — see 20260101000019_public_appointment_lookup.sql):
--
--   1. get_public_customer_appointments() stops returning appointments
--      whose calendar day (in the business's own timezone — see
--      app_timezone(), 20260101000022_fix_appointment_timezone.sql) is
--      already in the past. It also now returns can_cancel, computed
--      with the exact same rule get_public_appointment_by_token() uses
--      (20260101000021_photos_whatsapp_cancellation.sql), so the UI
--      never has to re-derive that logic itself.
--
--   2. A new cancel_public_appointment_by_phone(): lets a visitor
--      cancel directly from the lookup screen using their phone number
--      as proof of ownership — NOT by exposing cancel_token there.
--      cancel_token stays exactly as exclusive to the post-booking
--      WhatsApp link as it already was (see that migration's own
--      comment on why) — this is a separate, independent path with its
--      own authorization check (slug + phone + appointment id must all
--      match the same row), at the same trust level already governing
--      what this screen can see in the first place. Mirrors
--      cancel_appointment_by_token()'s idempotent behavior exactly.

-- Adding can_cancel to the output changes the function's return type,
-- which CREATE OR REPLACE FUNCTION rejects — same reasoning as
-- log_whatsapp_message() in 20260101000026_whatsapp_plan_gating_and_subscription_alerts.sql.
drop function if exists public.get_public_customer_appointments(text, text);

create function public.get_public_customer_appointments(
  p_slug text,
  p_phone text
)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  service_name text,
  professional_name text,
  can_cancel boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id, a.starts_at, a.ends_at, a.status, s.name, p.name,
    a.status not in ('cancelado', 'concluido') and a.starts_at > now()
  from public.appointments a
  join public.companies c on c.id = a.company_id
  join public.customers cu on cu.id = a.customer_id
  join public.services s on s.id = a.service_id
  join public.professionals p on p.id = a.professional_id
  where c.slug = p_slug
    and cu.phone = btrim(coalesce(p_phone, ''))
    and (a.starts_at at time zone public.app_timezone())::date
        >= (now() at time zone public.app_timezone())::date
  order by a.starts_at desc;
$$;

comment on function public.get_public_customer_appointments is
  'Public (anon) lookup of a visitor''s own appointments by phone number, scoped to one company via its slug. Only today-or-later appointments (business''s own calendar day) are returned. Returns only appointment/service/professional fields — never the customer row (email, notes) or any other customer''s data.';

create or replace function public.cancel_public_appointment_by_phone(
  p_slug text,
  p_phone text,
  p_appointment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
begin
  select a.* into v_appointment
  from public.appointments a
  join public.companies c on c.id = a.company_id
  join public.customers cu on cu.id = a.customer_id
  where a.id = p_appointment_id
    and c.slug = p_slug
    and cu.phone = btrim(coalesce(p_phone, ''));

  if not found then
    return jsonb_build_object('found', false);
  end if;

  if v_appointment.status not in ('cancelado', 'concluido') and v_appointment.starts_at > now() then
    update public.appointments set status = 'cancelado' where id = v_appointment.id;
    v_appointment.status := 'cancelado';

    perform public.write_audit_log(
      v_appointment.company_id, 'public_appointment_cancelled', 'appointment', v_appointment.id,
      jsonb_build_object('source', 'public_cancel_by_phone')
    );
  end if;

  return jsonb_build_object('found', true, 'status', v_appointment.status);
end;
$$;

comment on function public.cancel_public_appointment_by_phone is
  'Cancel path for the phone-lookup screen — separate from cancel_appointment_by_token (the WhatsApp-link flow). Re-validates slug + phone + appointment id all match the same row before cancelling; only ever called from an explicit "Confirmar cancelamento" click. Idempotent, same as cancel_appointment_by_token.';

revoke all on function public.get_public_customer_appointments(text, text) from public;
grant execute on function public.get_public_customer_appointments(text, text) to anon, authenticated;

revoke all on function public.cancel_public_appointment_by_phone(text, text, uuid) from public;
grant execute on function public.cancel_public_appointment_by_phone(text, text, uuid) to anon, authenticated;
