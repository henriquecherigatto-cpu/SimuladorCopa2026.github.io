-- Three independent additions, grouped in one migration:
--
--   1. professionals.photo_url + a public "professional-photos" storage
--      bucket, so a real photo can be shown instead of the colored-
--      initials avatar (owner's agenda, the public booking page's
--      professional picker).
--   2. companies.whatsapp_number — a dedicated WhatsApp-capable number
--      the owner sets explicitly, separate from the general contact
--      phone (which may not even be a WhatsApp number).
--   3. appointments.cancel_token + two public (anon) functions, so a
--      client who received a booking confirmation can cancel their
--      own appointment from a link, with no login, freeing up the
--      professional's slot — without ever exposing a door to cancel
--      anyone else's appointment.

-- ---------------------------------------------------------------------
-- 1. Professional photo.
-- ---------------------------------------------------------------------
alter table public.professionals add column photo_url text;

comment on column public.professionals.photo_url is
  'Public URL of the professional''s photo in the professional-photos storage bucket. Null falls back to the colored-initials avatar.';

-- Guarded behind a check for the storage schema: the throwaway
-- Postgres container supabase/tests/run-local-tests.sh applies these
-- migrations against (see that script) only ever layers on the real
-- product schema plus a local auth stub — it has no Supabase Storage
-- at all. A real Supabase stack (local `supabase start` or
-- production) always has it, so this block runs there unchanged.
-- Everything storage-related is dynamic SQL (EXECUTE) specifically so
-- that `storage.objects`/`storage.buckets` are never resolved when
-- the schema doesn't exist, even to check they exist.
do $migration$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $sql$
      insert into storage.buckets (id, name, public)
      values ('professional-photos', 'professional-photos', true)
      on conflict (id) do nothing
    $sql$;

    -- Object path convention: <company_id>/<random filename>. Anyone
    -- can read (the photo must display on the public booking page
    -- too); only an authenticated owner can write, and only under
    -- their own company's folder — storage.foldername(name) splits
    -- the object path into segments, so [1] is the company_id
    -- segment. A path that isn't a real company_id the caller owns
    -- simply fails has_company_role() (or the ::uuid cast raises),
    -- both of which deny the write.
    execute $sql$
      create policy professional_photos_public_read
        on storage.objects for select
        using (bucket_id = 'professional-photos')
    $sql$;

    execute $sql$
      create policy professional_photos_owner_insert
        on storage.objects for insert
        to authenticated
        with check (
          bucket_id = 'professional-photos'
          and public.has_company_role(((storage.foldername(name))[1])::uuid, array['owner']::public.company_member_role[])
        )
    $sql$;

    execute $sql$
      create policy professional_photos_owner_update
        on storage.objects for update
        to authenticated
        using (
          bucket_id = 'professional-photos'
          and public.has_company_role(((storage.foldername(name))[1])::uuid, array['owner']::public.company_member_role[])
        )
        with check (
          bucket_id = 'professional-photos'
          and public.has_company_role(((storage.foldername(name))[1])::uuid, array['owner']::public.company_member_role[])
        )
    $sql$;

    execute $sql$
      create policy professional_photos_owner_delete
        on storage.objects for delete
        to authenticated
        using (
          bucket_id = 'professional-photos'
          and public.has_company_role(((storage.foldername(name))[1])::uuid, array['owner']::public.company_member_role[])
        )
    $sql$;
  end if;
end;
$migration$;

-- ---------------------------------------------------------------------
-- 2. Company's own WhatsApp number (distinct from the general contact
-- phone, which may not be a WhatsApp-capable number at all).
-- ---------------------------------------------------------------------
alter table public.companies add column whatsapp_number text;

comment on column public.companies.whatsapp_number is
  'WhatsApp-capable number the owner explicitly provides, used for the "Falar no WhatsApp" link and referenced in booking confirmation messages. Falls back to companies.phone when unset.';

-- ---------------------------------------------------------------------
-- 3. Self-service cancellation by link.
-- ---------------------------------------------------------------------

-- A SEPARATE random token from the appointment's own id, on purpose:
-- the id is already returned to a visitor elsewhere (the "consultar
-- meu agendamento" lookup), so reusing it as a cancel credential would
-- mean anything that ever legitimately saw an appointment's id could
-- also cancel it. cancel_token is never returned by any read path —
-- only handed to the booking visitor once, at creation time.
alter table public.appointments
  add column cancel_token uuid not null default gen_random_uuid();

alter table public.appointments
  add constraint appointments_cancel_token_key unique (cancel_token);

comment on column public.appointments.cancel_token is
  'Unguessable, single-purpose credential for the public cancel-by-link flow. Never exposed by any read path other than immediately after booking.';

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
        'whatsapp_number', coalesce(c.whatsapp_number, c.phone)
      )
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

comment on function public.get_public_booking_page is
  'Public (anon) read of exactly what a self-service booking page needs for one company: name/address/phone/whatsapp_number, active services, active professionals (with photo) and which services each performs. Nothing else from companies/professionals/services is exposed.';

-- create_public_appointment now also returns the new booking's
-- cancel_token, so the caller (the TypeScript server action) can
-- build and send a cancel link right after booking. The return type
-- changes from a bare uuid to jsonb, so the old signature is dropped
-- first — CREATE OR REPLACE cannot change a function's return type.
drop function if exists public.create_public_appointment(text, uuid, uuid, date, time, text, text, text, text);

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
returns jsonb
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
  v_cancel_token uuid;
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

  insert into public.appointments (
    company_id, customer_id, professional_id, service_id, starts_at, ends_at, notes, created_by
  )
  values (
    v_company_id, v_customer_id, p_professional_id, p_service_id, v_starts_at, v_ends_at,
    nullif(btrim(coalesce(p_notes, '')), ''), null
  )
  returning id, cancel_token into v_appointment_id, v_cancel_token;

  perform public.write_audit_log(
    v_company_id, 'public_appointment_created', 'appointment', v_appointment_id,
    jsonb_build_object('customer_id', v_customer_id, 'source', 'public_booking_page')
  );

  -- get_public_appointment_by_token() is defined further down in this
  -- same migration — Postgres only needs it to exist by the time this
  -- function is actually CALLED, not at CREATE time, so the forward
  -- reference is fine. Reusing it here (rather than re-deriving
  -- company/service/professional names a second way) means the
  -- confirmation message composed from this result is always exactly
  -- what the lookup/cancel page would also show for the same token.
  return (public.get_public_appointment_by_token(v_cancel_token))
    || jsonb_build_object('id', v_appointment_id, 'cancel_token', v_cancel_token);
end;
$$;

comment on function public.create_public_appointment is
  'The only way an anonymous visitor can create an appointment. Re-validates slug/service/professional membership server-side and goes through the same business-hours trigger and no-overlap exclusion constraint as every other appointment insert. Returns the new id, cancel_token, and the same display fields (company_name, service_name, professional_name, starts_at) get_public_appointment_by_token() would return for that token, so the confirmation message is built from server-confirmed data, never client-held state.';

-- ---------------------------------------------------------------------
-- Public cancel-by-link flow: a read-only lookup (safe to call on a
-- bare page visit, e.g. a link-preview bot) and a separate action that
-- actually cancels (only ever called from an explicit button click,
-- never on page load).
-- ---------------------------------------------------------------------
create or replace function public.get_public_appointment_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'found', true,
    'company_name', c.name,
    'service_name', s.name,
    'professional_name', p.name,
    'starts_at', a.starts_at,
    'status', a.status,
    'can_cancel', a.status not in ('cancelado', 'concluido') and a.starts_at > now()
  )
  into v_result
  from public.appointments a
  join public.companies c on c.id = a.company_id
  join public.services s on s.id = a.service_id
  join public.professionals p on p.id = a.professional_id
  where a.cancel_token = p_token;

  -- A zero-row match makes the SELECT ... INTO above leave v_result
  -- NULL rather than a jsonb value, since there is no row for
  -- jsonb_build_object() to run against — an unmatched token must
  -- still come back as a real {"found": false} object, never a bare
  -- SQL NULL, so callers can always safely read ->> 'found'.
  if v_result is null then
    return jsonb_build_object('found', false);
  end if;

  return v_result;
end;
$$;

comment on function public.get_public_appointment_by_token is
  'Public (anon) read-only lookup for the cancel-by-link page. Safe to call on a bare page visit (e.g. a messaging app''s link-preview bot) since it never changes anything.';

create or replace function public.cancel_appointment_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
begin
  select * into v_appointment from public.appointments where cancel_token = p_token;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  if v_appointment.status not in ('cancelado', 'concluido') and v_appointment.starts_at > now() then
    update public.appointments set status = 'cancelado' where id = v_appointment.id;

    perform public.write_audit_log(
      v_appointment.company_id, 'public_appointment_cancelled', 'appointment', v_appointment.id,
      jsonb_build_object('source', 'public_cancel_link')
    );
  end if;

  return public.get_public_appointment_by_token(p_token);
end;
$$;

comment on function public.cancel_appointment_by_token is
  'The only way an anonymous visitor can cancel an appointment — only ever called from an explicit "Confirmar cancelamento" button click, never as a side effect of loading the page. Idempotent: calling it again on an already-cancelled or past appointment just returns its current state instead of erroring.';

revoke all on function public.get_public_booking_page(text) from public;
revoke all on function public.create_public_appointment(text, uuid, uuid, date, time, text, text, text, text) from public;
revoke all on function public.get_public_appointment_by_token(uuid) from public;
revoke all on function public.cancel_appointment_by_token(uuid) from public;

grant execute on function public.get_public_booking_page(text) to anon, authenticated;
grant execute on function public.create_public_appointment(text, uuid, uuid, date, time, text, text, text, text) to anon, authenticated;
grant execute on function public.get_public_appointment_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_appointment_by_token(uuid) to anon, authenticated;
