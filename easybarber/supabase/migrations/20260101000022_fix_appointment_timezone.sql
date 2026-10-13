-- Fix: appointment times were off by exactly the UTC offset of
-- America/Sao_Paulo (3h) once converted for display.
--
-- Root cause: every place that turned a (date, time) pair typed by a
-- visitor/owner into a `timestamptz` did `p_date + p_start_time`,
-- which produces a plain `timestamp` (no tz attached) that Postgres
-- then casts to `timestamptz` using the ACTIVE SESSION's timezone —
-- which is UTC on this stack (`show timezone`), not the business's
-- real timezone. Booking "09:00" therefore stored
-- 2026-10-14T09:00:00Z instead of the correct
-- 2026-10-14T12:00:00Z (09:00 America/Sao_Paulo = UTC-3). A browser
-- in Brazil later converts that wrong UTC instant back to local time
-- correctly, which is exactly why the *display* was off by 3h even
-- though nothing about the display code itself was wrong.
--
-- The same ambiguity runs the other way too: every place that pulled
-- a calendar date, day-of-week or time-of-day back out of a
-- `timestamptz` (the business-hours trigger, the two
-- get_available_slots() variants, the "don't offer past slots for
-- today" check, the "can't book in the past" guard) used a bare
-- `::date` / `::time` / `extract(dow from ...)` cast or bare
-- `current_date`/`now()` comparison — also session-timezone-dependent,
-- also silently wrong by the same 3h. Fixing only the write side
-- (storage) without also fixing these read sites would have broken
-- them in the *opposite* direction, since they currently "accidentally"
-- round-trip correctly only because the write side was *consistently*
-- wrong in the same way. So this migration fixes both sides together,
-- pinned to one explicit zone rather than whatever the session
-- happens to be configured with.
--
-- app_timezone() centralizes that one zone so every call site agrees,
-- and so there's a single place to change if this ever becomes a
-- multi-timezone product (it is not today — every company is a
-- Brazilian barbershop).
create or replace function public.app_timezone()
returns text
language sql
immutable
as $$
  select 'America/Sao_Paulo'
$$;

comment on function public.app_timezone() is
  'The one timezone appointment-facing date/time arithmetic is pinned to. See 20260101000022_fix_appointment_timezone.sql for why this exists.';

revoke all on function public.app_timezone() from public;
grant execute on function public.app_timezone() to anon, authenticated;

-- ---------------------------------------------------------------------
-- check_appointment_within_hours(): the real backstop (runs on every
-- insert/update regardless of which code path wrote the row). Same
-- body as 20260101000020_professional_breaks.sql's version, with every
-- date/time extraction from a timestamptz now going through
-- app_timezone() first.
-- ---------------------------------------------------------------------
create or replace function public.check_appointment_within_hours()
returns trigger
language plpgsql
as $$
declare
  hours public.business_hours%rowtype;
  blocked boolean;
  on_break boolean;
begin
  if new.status = 'cancelado' then
    return new;
  end if;

  if (new.starts_at at time zone public.app_timezone())::date
     <> (new.ends_at at time zone public.app_timezone())::date then
    raise exception 'Appointments must start and end on the same calendar day.'
      using errcode = 'P0001';
  end if;

  select * into hours
  from public.business_hours
  where company_id = new.company_id
    and day_of_week = extract(dow from new.starts_at at time zone public.app_timezone())::smallint;

  if not found or not hours.is_open then
    raise exception 'The company is closed on this day.'
      using errcode = 'P0001';
  end if;

  if (new.starts_at at time zone public.app_timezone())::time < hours.start_time
     or (new.ends_at at time zone public.app_timezone())::time > hours.end_time then
    raise exception 'The appointment falls outside business hours.'
      using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.time_blocks tb
    where tb.company_id = new.company_id
      and (tb.professional_id is null or tb.professional_id = new.professional_id)
      and tstzrange(tb.starts_at, tb.ends_at) && tstzrange(new.starts_at, new.ends_at)
  ) into blocked;

  if blocked then
    raise exception 'The requested time overlaps a blocked interval (time off, holiday, etc).'
      using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.professional_breaks b
    where b.professional_id = new.professional_id
      and b.start_time < (new.ends_at at time zone public.app_timezone())::time
      and b.end_time > (new.starts_at at time zone public.app_timezone())::time
  ) into on_break;

  if on_break then
    raise exception 'The requested time overlaps the professional''s scheduled break.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- get_available_slots(): same body as 20260101000020_professional_breaks.sql's
-- version, with "today"/"now" and the (date + minutes) comparison
-- boundaries now explicitly anchored to app_timezone() instead of the
-- session timezone.
-- ---------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_company_id uuid,
  p_professional_id uuid,
  p_service_id uuid,
  p_date date,
  p_step_minutes int default 15
)
returns table (slot_start time)
language plpgsql
stable
as $$
declare
  v_duration int;
  v_weekday smallint;
  v_hours public.business_hours%rowtype;
  v_professional public.professionals%rowtype;
  v_open_minutes int;
  v_close_minutes int;
  v_cursor int;
  v_now_local timestamp;
begin
  select duration_min into v_duration
  from public.services
  where id = p_service_id and company_id = p_company_id and active;

  if v_duration is null or v_duration <= 0 then
    return;
  end if;

  select * into v_professional
  from public.professionals
  where id = p_professional_id and company_id = p_company_id and active;

  if not found then
    return;
  end if;

  v_weekday := extract(dow from p_date)::smallint;

  if v_weekday = any (v_professional.weekly_days_off) then
    return;
  end if;

  select * into v_hours
  from public.business_hours
  where company_id = p_company_id and day_of_week = v_weekday;

  if not found or not v_hours.is_open then
    return;
  end if;

  v_open_minutes := greatest(
    extract(hour from v_hours.start_time)::int * 60 + extract(minute from v_hours.start_time)::int,
    extract(hour from v_professional.work_start)::int * 60 + extract(minute from v_professional.work_start)::int
  );
  v_close_minutes := least(
    extract(hour from v_hours.end_time)::int * 60 + extract(minute from v_hours.end_time)::int,
    extract(hour from v_professional.work_end)::int * 60 + extract(minute from v_professional.work_end)::int
  );

  -- "Today" and "now", as the business's own clock reads them — not
  -- the session's.
  v_now_local := now() at time zone public.app_timezone();

  if p_date = v_now_local::date then
    v_open_minutes := greatest(
      v_open_minutes,
      ((extract(hour from v_now_local) * 60 + extract(minute from v_now_local))::int / p_step_minutes + 1) * p_step_minutes
    );
  end if;

  v_cursor := v_open_minutes;
  while v_cursor + v_duration <= v_close_minutes loop
    if not exists (
      select 1
      from public.appointments a
      where a.professional_id = p_professional_id
        and a.status <> 'cancelado'
        and a.starts_at < ((p_date + make_interval(mins => v_cursor + v_duration)) at time zone public.app_timezone())
        and a.ends_at > ((p_date + make_interval(mins => v_cursor)) at time zone public.app_timezone())
    ) and not exists (
      select 1
      from public.time_blocks tb
      where tb.company_id = p_company_id
        and (tb.professional_id is null or tb.professional_id = p_professional_id)
        and tb.starts_at < ((p_date + make_interval(mins => v_cursor + v_duration)) at time zone public.app_timezone())
        and tb.ends_at > ((p_date + make_interval(mins => v_cursor)) at time zone public.app_timezone())
    ) and not exists (
      select 1
      from public.professional_breaks b
      where b.professional_id = p_professional_id
        and (extract(hour from b.start_time)::int * 60 + extract(minute from b.start_time)::int) < (v_cursor + v_duration)
        and (extract(hour from b.end_time)::int * 60 + extract(minute from b.end_time)::int) > v_cursor
    ) then
      slot_start := make_interval(mins => v_cursor)::time;
      return next;
    end if;
    v_cursor := v_cursor + p_step_minutes;
  end loop;
end;
$$;

comment on function public.get_available_slots is
  'Server-side source of truth for bookable time slots — mirrors check_appointment_within_hours() and the appointments exclusion constraint, so every slot it returns is actually insertable. All date/time arithmetic is anchored to app_timezone(), not the session timezone — see 20260101000022_fix_appointment_timezone.sql.';

grant execute on function public.get_available_slots(uuid, uuid, uuid, date, int) to authenticated;

-- ---------------------------------------------------------------------
-- get_public_available_slots(): only its own "not in the past" guard
-- needs fixing — it already delegates the rest to get_available_slots()
-- above.
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
  if p_date < (now() at time zone public.app_timezone())::date then
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

-- ---------------------------------------------------------------------
-- create_public_appointment(): same body as
-- 20260101000021_photos_whatsapp_cancellation.sql's version (jsonb
-- return, cancel_token) — fixes the actual storage bug this whole
-- migration exists for, plus the same "not in the past" guard as
-- above.
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
  if p_date < (now() at time zone public.app_timezone())::date then
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

  v_starts_at := (p_date + p_start_time) at time zone public.app_timezone();
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

  return (public.get_public_appointment_by_token(v_cancel_token))
    || jsonb_build_object('id', v_appointment_id, 'cancel_token', v_cancel_token);
end;
$$;

revoke all on function public.get_public_available_slots(text, uuid, uuid, date) from public;
grant execute on function public.get_public_available_slots(text, uuid, uuid, date) to anon, authenticated;

revoke all on function public.create_public_appointment(text, uuid, uuid, date, time, text, text, text, text) from public;
grant execute on function public.create_public_appointment(text, uuid, uuid, date, time, text, text, text, text) to anon, authenticated;
