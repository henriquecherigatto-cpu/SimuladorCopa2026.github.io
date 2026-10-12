-- Pausas programadas: recurring daily breaks for a professional (lunch,
-- a short afternoon break, etc). Unlike time_blocks (one-off, absolute
-- timestamptz), a break is a time-of-day window that recurs on every
-- working day — the same mental model as professionals.work_start /
-- work_end, just allowing more than one window and gaps between them.
--
-- A professional can have any number of breaks (the owner adds them
-- one at a time). They must never overlap each other, and — like
-- business_hours and time_blocks before them — the database is the
-- real backstop against a slot inside a break ever becoming an
-- appointment, not just the UI or get_available_slots().

create table public.professional_breaks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  start_time time not null,
  end_time time not null,
  label text,
  created_at timestamptz not null default now(),
  check (start_time < end_time),
  -- Needed so this row can only ever point at a professional from the
  -- same company — the same "same company" guard used throughout the
  -- schema (see professionals_company_id_id_key).
  constraint professional_breaks_same_company
    foreign key (company_id, professional_id)
    references public.professionals (company_id, id)
);

comment on table public.professional_breaks is
  'Recurring daily break windows for a professional (lunch, short breaks). A break applies on every working day — see get_available_slots() and check_appointment_within_hours(), which both treat it the same as business hours: the real backstop, not just the UI.';

create index professional_breaks_professional_id_idx on public.professional_breaks (professional_id);

-- Two breaks for the same professional must never overlap — mirrors
-- check_professional_service_same_company()'s style of a plain
-- exists-query trigger rather than a range-type exclusion constraint,
-- since `time` has no built-in gist range support.
create or replace function public.check_professional_break_no_overlap()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.professional_breaks b
    where b.professional_id = new.professional_id
      and b.id <> new.id
      and b.start_time < new.end_time
      and b.end_time > new.start_time
  ) then
    raise exception 'This break overlaps another break already scheduled for this professional.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger professional_breaks_no_overlap
  before insert or update on public.professional_breaks
  for each row execute function public.check_professional_break_no_overlap();

-- ---------------------------------------------------------------------
-- RLS: company members read, owner writes — identical shape to
-- business_hours / time_blocks.
-- ---------------------------------------------------------------------
alter table public.professional_breaks enable row level security;

create policy professional_breaks_select on public.professional_breaks
  for select to authenticated
  using (company_id in (select public.user_company_ids()));

create policy professional_breaks_write on public.professional_breaks
  for all to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]))
  with check (public.has_company_role(company_id, array['owner']::public.company_member_role[]));

-- ---------------------------------------------------------------------
-- Wire breaks into the two places that decide what's bookable:
--
--   1. get_available_slots() — a candidate slot that overlaps any of
--      the professional's breaks is simply never offered.
--   2. check_appointment_within_hours() — reject an insert/update that
--      lands inside a break, exactly like it already rejects one
--      outside business hours or inside a time_block. This is the
--      real guarantee; get_available_slots() computing a clean list is
--      only a convenience on top of it.
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

  -- Don't offer slots in the past for today.
  if p_date = current_date then
    v_open_minutes := greatest(
      v_open_minutes,
      ((extract(hour from now()) * 60 + extract(minute from now()))::int / p_step_minutes + 1) * p_step_minutes
    );
  end if;

  v_cursor := v_open_minutes;
  while v_cursor + v_duration <= v_close_minutes loop
    if not exists (
      select 1
      from public.appointments a
      where a.professional_id = p_professional_id
        and a.status <> 'cancelado'
        and a.starts_at < (p_date + make_interval(mins => v_cursor + v_duration))
        and a.ends_at > (p_date + make_interval(mins => v_cursor))
    ) and not exists (
      select 1
      from public.time_blocks tb
      where tb.company_id = p_company_id
        and (tb.professional_id is null or tb.professional_id = p_professional_id)
        and tb.starts_at < (p_date + make_interval(mins => v_cursor + v_duration))
        and tb.ends_at > (p_date + make_interval(mins => v_cursor))
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
  'Server-side source of truth for bookable time slots — mirrors check_appointment_within_hours() and the appointments exclusion constraint, so every slot it returns is actually insertable. Excludes the professional''s scheduled breaks the same way it excludes time_blocks.';

grant execute on function public.get_available_slots(uuid, uuid, uuid, date, int) to authenticated;

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

  if new.starts_at::date <> new.ends_at::date then
    raise exception 'Appointments must start and end on the same calendar day.'
      using errcode = 'P0001';
  end if;

  select * into hours
  from public.business_hours
  where company_id = new.company_id
    and day_of_week = extract(dow from new.starts_at)::smallint;

  if not found or not hours.is_open then
    raise exception 'The company is closed on this day.'
      using errcode = 'P0001';
  end if;

  if new.starts_at::time < hours.start_time or new.ends_at::time > hours.end_time then
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
      and b.start_time < new.ends_at::time
      and b.end_time > new.starts_at::time
  ) into on_break;

  if on_break then
    raise exception 'The requested time overlaps the professional''s scheduled break.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Same two-layer grant pattern as every other table in
-- 20260101000014_grants.sql: the GRANT lets authenticated attempt the
-- statement at all, RLS (above) decides which rows and which roles.
grant select, insert, update, delete on public.professional_breaks to authenticated;
