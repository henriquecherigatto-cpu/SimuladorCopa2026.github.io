-- "Consultar meu agendamento" (/agendar/<slug>) was matching phone
-- numbers with a plain exact string comparison (cu.phone = p_phone),
-- but customers.phone is stored exactly as typed on the booking form
-- — e.g. "(19) 9 9999-0004" (see formatBrazilianPhoneInput() in
-- src/lib/utils.ts, used by PublicBookingForm.tsx). The lookup
-- screen's own phone field had no equivalent masking, so a visitor
-- typing their number in any other shape (no parentheses, no spaces,
-- a different grouping, ...) got zero results even though it's the
-- same number. Fixing the lookup form's input to use the same mask
-- (separate frontend change) helps the common case, but the real fix
-- is comparing by digits alone here, so formatting can never matter
-- again, for any entry point, past or future.

create or replace function public.phone_digits(p_phone text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
$$;

comment on function public.phone_digits is
  'Strips everything but digits from a phone number, so two numbers that differ only in punctuation/spacing still compare equal.';

revoke all on function public.phone_digits(text) from public;
grant execute on function public.phone_digits(text) to anon, authenticated;

-- Same signature and return type as the current definition in
-- 20260101000029_public_lookup_cancel_and_date_filter.sql — only the
-- phone comparison in the body changes, so CREATE OR REPLACE is safe
-- (no drop needed, grants are untouched).
create or replace function public.get_public_customer_appointments(
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
    and public.phone_digits(cu.phone) = public.phone_digits(p_phone)
    and (a.starts_at at time zone public.app_timezone())::date
        >= (now() at time zone public.app_timezone())::date
  order by a.starts_at desc;
$$;

comment on function public.get_public_customer_appointments is
  'Public (anon) lookup of a visitor''s own appointments by phone number, scoped to one company via its slug. Phones are compared by digits only (phone_digits()), so formatting differences between how the number was entered at booking time vs. lookup time never cause a miss. Only today-or-later appointments (business''s own calendar day) are returned. Returns only appointment/service/professional fields — never the customer row (email, notes) or any other customer''s data.';

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
    and public.phone_digits(cu.phone) = public.phone_digits(p_phone);

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
  'Cancel path for the phone-lookup screen — separate from cancel_appointment_by_token (the WhatsApp-link flow). Re-validates slug + phone (compared by digits only, see phone_digits()) + appointment id all match the same row before cancelling; only ever called from an explicit "Confirmar cancelamento" click. Idempotent, same as cancel_appointment_by_token.';
