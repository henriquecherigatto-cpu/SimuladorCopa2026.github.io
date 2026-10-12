-- Public self-service booking: lets a barbearia's own clients see
-- availability and book an appointment themselves, from a public link
-- (/agendar/<slug>), with no login at all.
--
-- The design keeps the public surface as small and reviewable as
-- possible: no new RLS policy opens the raw tables (companies,
-- professionals, services, business_hours, appointments, ...) to
-- `anon`. Instead, three SECURITY DEFINER functions are the ONLY
-- doors anon has, each one returning/accepting exactly what a public
-- booking page needs and nothing else:
--
--   * get_public_booking_page(slug)       — company + active services
--     + active professionals (and which services each one performs).
--   * get_public_available_slots(slug, ...) — bookable times, reusing
--     the exact same get_available_slots() logic the authenticated
--     app uses, so the public page can never offer a slot the
--     authenticated one wouldn't.
--   * create_public_appointment(slug, ...) — creates (or reuses, by
--     phone) a customer and inserts the appointment. Still goes
--     through appointments_within_business_hours and the
--     appointments_no_overlap_per_professional exclusion constraint
--     like every other appointment insert — a public caller gets no
--     special treatment from those guarantees.
--
-- Every one of the three re-derives company_id from the slug and
-- re-validates that any professional_id/service_id it's given
-- actually belongs to (and is active in) that company — never trusts
-- an id the caller supplies at face value, since the caller here is
-- the public internet.

-- ---------------------------------------------------------------------
-- companies.slug: a stable, URL-safe public identifier, independent
-- of the company's display name (which can contain anything and can
-- change).
-- ---------------------------------------------------------------------
alter table public.companies add column slug text;

create or replace function public.generate_company_slug(p_name text)
returns text
language plpgsql
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix int := 0;
begin
  v_base := lower(regexp_replace(regexp_replace(btrim(coalesce(p_name, '')), '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'));
  if v_base = '' then
    v_base := 'barbearia';
  end if;

  v_candidate := v_base;
  while exists (select 1 from public.companies where slug = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
  end loop;

  return v_candidate;
end;
$$;

comment on function public.generate_company_slug is
  'Derives a unique, URL-safe slug from a company name, appending -2, -3, ... on collision.';

update public.companies set slug = public.generate_company_slug(name) where slug is null;

alter table public.companies alter column slug set not null;
alter table public.companies add constraint companies_slug_key unique (slug);
alter table public.companies add constraint companies_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

comment on column public.companies.slug is
  'Public, URL-safe identifier used by the /agendar/<slug> self-service booking page. Independent of name so renaming a company never breaks a link someone saved.';

-- create_company_with_owner now sets a slug at signup time too.
create or replace function public.create_company_with_owner(
  p_name text,
  p_phone text,
  p_cnpj text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_default_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create a company.'
      using errcode = '42501';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Company name is required.' using errcode = '22023';
  end if;

  if btrim(coalesce(p_phone, '')) = '' then
    raise exception 'Company phone is required.' using errcode = '22023';
  end if;

  insert into public.companies (name, phone, cnpj, address, created_by, slug)
  values (
    btrim(p_name), btrim(p_phone), nullif(btrim(coalesce(p_cnpj, '')), ''), nullif(btrim(coalesce(p_address, '')), ''),
    auth.uid(), public.generate_company_slug(p_name)
  )
  returning id into v_company_id;

  insert into public.company_members (company_id, profile_id, role)
  values (v_company_id, auth.uid(), 'owner');

  insert into public.business_hours (company_id, day_of_week, is_open, start_time, end_time)
  select v_company_id, d, true, '08:00', '18:00'
  from generate_series(0, 6) as d;

  select id into v_default_plan_id
  from public.plans
  where active
  order by price_cents asc
  limit 1;

  if v_default_plan_id is not null then
    insert into public.subscriptions (company_id, plan_id, status, grace_period_days)
    values (v_company_id, v_default_plan_id, 'pendente', 10);
  end if;

  perform public.write_audit_log(
    v_company_id, 'company_created', 'company', v_company_id,
    jsonb_build_object('name', p_name)
  );

  return v_company_id;
end;
$$;

-- ---------------------------------------------------------------------
-- appointments.created_by is nullable: a public booking has no
-- profiles row behind it (no login happened at all).
-- ---------------------------------------------------------------------
alter table public.appointments alter column created_by drop not null;

-- ---------------------------------------------------------------------
-- get_public_booking_page: everything a booking page needs to render,
-- in one call.
-- ---------------------------------------------------------------------
create or replace function public.get_public_booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'company', (
      select jsonb_build_object('id', c.id, 'name', c.name, 'address', c.address, 'phone', c.phone)
      from public.companies c
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
          'id', p.id, 'name', p.name, 'color', p.color,
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

comment on function public.get_public_booking_page is
  'Public (anon) read of exactly what a self-service booking page needs for one company: name/address/phone, active services, active professionals and which services each performs. Nothing else from companies/professionals/services is exposed.';

-- ---------------------------------------------------------------------
-- get_public_available_slots: same source of truth as the
-- authenticated app (get_available_slots), reached through a slug
-- instead of a company_id the caller would otherwise have to be
-- trusted to supply correctly.
-- ---------------------------------------------------------------------
create or replace function public.get_public_available_slots(
  p_slug text,
  p_professional_id uuid,
  p_service_id uuid,
  p_date date
)
returns table (slot_start time)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if p_date < current_date then
    return;
  end if;

  select id into v_company_id from public.companies where slug = p_slug;
  if v_company_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.professionals
    where id = p_professional_id and company_id = v_company_id and active
  ) then
    return;
  end if;

  if not exists (
    select 1 from public.services
    where id = p_service_id and company_id = v_company_id and active
  ) then
    return;
  end if;

  if not exists (
    select 1 from public.professional_services
    where professional_id = p_professional_id and service_id = p_service_id
  ) then
    return;
  end if;

  return query
    select * from public.get_available_slots(v_company_id, p_professional_id, p_service_id, p_date);
end;
$$;

comment on function public.get_public_available_slots is
  'Public (anon) wrapper around get_available_slots(): re-derives company_id from the slug and re-validates professional/service/company membership before delegating, so it can never be tricked into computing availability for a mismatched company.';

-- ---------------------------------------------------------------------
-- create_public_appointment: the only way a public caller can ever
-- write an appointment. Re-validates everything server-side — never
-- trusts the slot the client claims is free; the exclusion constraint
-- on appointments is still the real backstop.
-- ---------------------------------------------------------------------
create or replace function public.create_public_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_date date,
  p_start_time time,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_duration int;
  v_customer_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_appointment_id uuid;
begin
  if btrim(coalesce(p_customer_name, '')) = '' then
    raise exception 'Customer name is required.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_customer_phone, '')) = '' then
    raise exception 'Customer phone is required.' using errcode = '22023';
  end if;
  if p_date < current_date then
    raise exception 'Cannot book an appointment in the past.' using errcode = 'P0001';
  end if;

  select id into v_company_id from public.companies where slug = p_slug;
  if v_company_id is null then
    raise exception 'Company not found.' using errcode = 'P0002';
  end if;

  select duration_min into v_duration
  from public.services
  where id = p_service_id and company_id = v_company_id and active;
  if v_duration is null then
    raise exception 'This service is not available.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.professionals
    where id = p_professional_id and company_id = v_company_id and active
  ) then
    raise exception 'This professional is not available.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.professional_services
    where professional_id = p_professional_id and service_id = p_service_id
  ) then
    raise exception 'This professional does not perform the selected service.' using errcode = 'P0001';
  end if;

  v_starts_at := p_date + p_start_time;
  v_ends_at := v_starts_at + make_interval(mins => v_duration);

  -- Reuse an existing customer by phone within this company (same
  -- dedupe rule the authenticated booking flow follows), rather than
  -- creating a duplicate row every time the same person books again.
  select id into v_customer_id
  from public.customers
  where company_id = v_company_id and phone = btrim(p_customer_phone)
  limit 1;

  if v_customer_id is null then
    insert into public.customers (company_id, name, phone, email)
    values (
      v_company_id, btrim(p_customer_name), btrim(p_customer_phone),
      nullif(btrim(coalesce(p_customer_email, '')), '')
    )
    returning id into v_customer_id;
  end if;

  -- created_by is left null (no profiles row exists for an anonymous
  -- booking); appointments_within_business_hours and the exclusion
  -- constraint below still apply exactly as for any other insert.
  insert into public.appointments (
    company_id, customer_id, professional_id, service_id, starts_at, ends_at, notes, created_by
  )
  values (
    v_company_id, v_customer_id, p_professional_id, p_service_id, v_starts_at, v_ends_at,
    nullif(btrim(coalesce(p_notes, '')), ''), null
  )
  returning id into v_appointment_id;

  perform public.write_audit_log(
    v_company_id, 'public_appointment_created', 'appointment', v_appointment_id,
    jsonb_build_object('customer_id', v_customer_id, 'source', 'public_booking_page')
  );

  return v_appointment_id;
end;
$$;

comment on function public.create_public_appointment is
  'The only way an anonymous visitor can create an appointment. Re-validates slug/service/professional membership server-side and goes through the same business-hours trigger and no-overlap exclusion constraint as every other appointment insert.';

-- ---------------------------------------------------------------------
-- Lock down execute grants: PUBLIC's default EXECUTE is revoked first
-- (defense in depth — same reasoning as the billing functions), then
-- explicitly re-granted to exactly the two roles that should be able
-- to call these: anon (the actual public visitor) and authenticated
-- (so a logged-in customer, or the barbearia's own owner testing the
-- link, can use the same page without it breaking).
-- ---------------------------------------------------------------------
grant usage on schema public to anon;

revoke all on function public.get_public_booking_page(text) from public;
revoke all on function public.get_public_available_slots(text, uuid, uuid, date) from public;
revoke all on function public.create_public_appointment(text, uuid, uuid, date, time, text, text, text, text) from public;

grant execute on function public.get_public_booking_page(text) to anon, authenticated;
grant execute on function public.get_public_available_slots(text, uuid, uuid, date) to anon, authenticated;
grant execute on function public.create_public_appointment(text, uuid, uuid, date, time, text, text, text, text) to anon, authenticated;
