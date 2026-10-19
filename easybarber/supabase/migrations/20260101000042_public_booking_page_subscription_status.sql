-- get_public_booking_page() now also returns the company's
-- subscription status, so /agendar/[slug] can show a clear
-- "not available yet" message instead of letting a customer fill out
-- the whole form only to hit create_public_appointment()'s own
-- rejection (20260101000041_pendente_blocks_bookings.sql) at submit
-- time. Same signature, body-only change — safe create or replace.

create or replace function public.get_public_booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'company', (
      select jsonb_build_object(
        'id', c.id, 'name', c.name, 'address', c.address, 'phone', c.phone,
        'whatsapp_number', coalesce(c.whatsapp_number, c.phone),
        'subscription_status', s.status
      )
      from public.companies c
      left join public.subscriptions s on s.company_id = c.id
      where c.slug = p_slug
    ),
    'services', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'name', s.name, 'description', s.description,
          'duration_min', s.duration_min, 'price_cents', s.price_cents
        ) order by s.name
      ), '[]'::jsonb)
      from public.services s
      join public.companies c on c.id = s.company_id
      where c.slug = p_slug and s.active
    ),
    'professionals', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', p.id, 'name', p.name, 'color', p.color, 'photo_url', p.photo_url,
          'service_ids', (
            select coalesce(jsonb_agg(ps.service_id), '[]'::jsonb)
            from public.professional_services ps
            where ps.professional_id = p.id
          )
        ) order by p.name
      ), '[]'::jsonb)
      from public.professionals p
      join public.companies c on c.id = p.company_id
      where c.slug = p_slug and p.active
    )
  );
$$;
