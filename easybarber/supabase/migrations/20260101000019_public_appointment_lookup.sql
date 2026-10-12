-- "Consultar meu agendamento": lets a visitor on the public booking
-- page (/agendar/<slug>) look up their own appointments by phone
-- number, with no login — the same no-RLS-exception approach as the
-- rest of the public booking surface (20260101000018_public_booking.sql):
-- one narrow SECURITY DEFINER function, granted to anon, that returns
-- exactly what this feature needs and nothing else. It never exposes
-- the customer's row itself (id, email, notes) — only their own
-- appointments, scoped to the one company the slug resolves to.
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
  professional_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.starts_at, a.ends_at, a.status, s.name, p.name
  from public.appointments a
  join public.companies c on c.id = a.company_id
  join public.customers cu on cu.id = a.customer_id
  join public.services s on s.id = a.service_id
  join public.professionals p on p.id = a.professional_id
  where c.slug = p_slug
    and cu.phone = btrim(coalesce(p_phone, ''))
  order by a.starts_at desc;
$$;

comment on function public.get_public_customer_appointments is
  'Public (anon) lookup of a visitor''s own appointments by phone number, scoped to one company via its slug. Returns only appointment/service/professional fields — never the customer row (email, notes) or any other customer''s data.';

revoke all on function public.get_public_customer_appointments(text, text) from public;
grant execute on function public.get_public_customer_appointments(text, text) to anon, authenticated;
