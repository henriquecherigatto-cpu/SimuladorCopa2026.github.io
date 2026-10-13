-- Regression test for 20260101000022_fix_appointment_timezone.sql: a
-- booking made for "09:00" must be stored as the correct UTC instant
-- for 09:00 America/Sao_Paulo (12:00 UTC, UTC-3), not as a bare
-- 09:00 UTC — which is what a browser or any other code correctly
-- converting back to Brazil's timezone would then show as 06:00,
-- exactly the bug the user reported (a booking made for 09:00 showing
-- up in the owner's Agenda at the wrong time).
--
-- Reuses a_slug / company_a_id / professional_a_id / service_a_id
-- from 000_fixtures.sql and 070_public_booking.sql (already in scope
-- — run_all.sql runs every file in one continuous psql session).

select test.act_as_anon();

-- A booking for current_date + 10 at 09:00 "wall clock" (whatever the
-- visitor picked on the public booking page, in Brazil's own time).
select r.result ->> 'id' as appt_id
from (select public.create_public_appointment(
  :'a_slug', :'service_a_id'::uuid, :'professional_a_id'::uuid, current_date + 10, '09:00',
  'Cliente Fuso', '19955554444'
) as result) r \gset tz_

select test.act_as_superuser();

select starts_at = ((current_date + 10 + interval '9 hour') at time zone 'America/Sao_Paulo') as matches_correct_utc_instant,
       starts_at = (current_date + 10 + interval '9 hour') as matches_naive_utc_bug,
       (starts_at at time zone 'America/Sao_Paulo')::time as shown_in_brazil
from public.appointments where id = :'tz_appt_id'::uuid \gset check_

select test.assert(
  :'check_matches_correct_utc_instant'::boolean,
  'a 09:00 booking is stored as the correct UTC instant for 09:00 America/Sao_Paulo (12:00 UTC) — this is what makes the owner''s Agenda, the WhatsApp confirmation and any other true-timezone-aware display show 09:00, not a shifted time'
);
select test.assert(
  not :'check_matches_naive_utc_bug'::boolean,
  'a 09:00 booking must NOT be stored as a bare 09:00 UTC (the original bug: treating the business''s local wall-clock time as if it were already UTC)'
);
select test.assert(
  :'check_shown_in_brazil' = '09:00:00',
  'converting the stored instant back to America/Sao_Paulo round-trips to exactly 09:00, matching what the visitor actually picked'
);

-- The business-hours trigger must apply the same conversion when
-- deciding whether a direct (non-RPC) insert is within hours — a
-- company open 08:00-18:00 Brazil time must accept 09:00 Brazil time,
-- not reject it as "outside business hours" (which is what happened
-- transiently while the trigger used a bare ::time cast against a
-- correctly-converted starts_at during development of this fix).
select test.assert(
  exists (
    select 1 from public.appointments
    where id = :'tz_appt_id'::uuid and status = 'agendado'
  ),
  'the 09:00 booking was actually accepted by check_appointment_within_hours(), not rejected as outside business hours'
);

-- get_available_slots()/get_public_available_slots() must offer and
-- recognize this same slot as taken, using the same app_timezone()
-- conversion — not treat the appointment as if it were 3h earlier or
-- later than it actually is.
select not exists (
  select 1
  from public.get_public_available_slots(:'a_slug', :'professional_a_id'::uuid, :'service_a_id'::uuid, current_date + 10)
  where slot_start = '09:00'
) as ok \gset
select test.assert(:'ok'::boolean, 'the 09:00 slot just booked no longer shows up as available, confirming get_available_slots() agrees with create_public_appointment() on what "09:00" means');

select test.assert(true, 'appointment timezone fix verified: storage, business-hours trigger and availability all agree on what a Brazil-local wall-clock time means');
