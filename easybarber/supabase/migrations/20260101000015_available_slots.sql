-- Server-side availability computation. The client must never decide
-- what's bookable on its own — this mirrors the same rules enforced
-- by check_appointment_within_hours() and the exclusion constraint on
-- appointments (business hours, the professional's own work hours and
-- weekly day off, time_blocks, and existing appointments), so a slot
-- this function returns is actually insertable.
--
-- SECURITY INVOKER (the default) on purpose: it only returns slots
-- computed from rows the calling user can already see under RLS. A
-- professional computing their own availability sees their own
-- appointments fully; an owner sees the whole company's. The
-- exclusion constraint on appointments is the actual backstop against
-- a double-booking even in the rare case this function
-- under-estimates a busy slot it can't see.
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
    ) then
      slot_start := make_interval(mins => v_cursor)::time;
      return next;
    end if;
    v_cursor := v_cursor + p_step_minutes;
  end loop;
end;
$$;

comment on function public.get_available_slots is
  'Server-side source of truth for bookable time slots — mirrors check_appointment_within_hours() and the appointments exclusion constraint, so every slot it returns is actually insertable.';

grant execute on function public.get_available_slots(uuid, uuid, uuid, date, int) to authenticated;
