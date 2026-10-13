-- Pausas programadas (20260101000020_professional_breaks.sql): a
-- recurring daily break window for a professional must (1) disappear
-- from get_available_slots(), (2) still be rejected at insert time
-- even if something tried to book it anyway, (3) never overlap
-- another break for the same professional, and (4) be readable/
-- writable only by that break's own company, exactly like
-- business_hours and time_blocks.
--
-- Reuses 000_fixtures.sql: professional_a_id ("Carlos (A)", company
-- A / "Barber 013") has one appointment at 10:00-10:45 tomorrow
-- (current_date + 1); 040_concurrency_conflict.sql (run earlier in
-- this shared session) adds a back-to-back one at 10:45-11:30. Both
-- breaks below are scheduled well clear of that 10:00-11:30 window so
-- these tests aren't entangled with it.

select test.act_as(:'owner_a_id'::uuid);

-- ---------------------------------------------------------------------
-- 1. The owner schedules two breaks for Carlos: lunch (13:00-14:00)
-- and a short afternoon break (15:15-15:30) — the same shape as the
-- feature request's example.
-- ---------------------------------------------------------------------
insert into public.professional_breaks (company_id, professional_id, start_time, end_time, label)
values (:'company_a_id'::uuid, :'professional_a_id'::uuid, '13:00', '14:00', 'Almoço')
returning id as break1_id \gset

insert into public.professional_breaks (company_id, professional_id, start_time, end_time, label)
values (:'company_a_id'::uuid, :'professional_a_id'::uuid, '15:15', '15:30', 'Pausa da tarde')
returning id as break2_id \gset

select test.assert(:'break1_id' is not null and :'break2_id' is not null, 'both breaks were created');

-- ---------------------------------------------------------------------
-- 2. A break overlapping an existing break for the SAME professional
-- is rejected — whether it overlaps the middle or just one edge.
-- ---------------------------------------------------------------------
select test.assert_denied(
  format(
    'insert into public.professional_breaks (company_id, professional_id, start_time, end_time) values (%L, %L, %L, %L)',
    :'company_a_id', :'professional_a_id', '13:15', '13:30'
  ),
  'a break entirely inside an existing break is rejected');

select test.assert_denied(
  format(
    'insert into public.professional_breaks (company_id, professional_id, start_time, end_time) values (%L, %L, %L, %L)',
    :'company_a_id', :'professional_a_id', '15:00', '15:20'
  ),
  'a break overlapping the edge of an existing break is rejected');

-- A break for a DIFFERENT professional at the exact same time is
-- unaffected — the no-overlap rule is scoped per professional.
select test.assert_row_count(1,
  test.exec_affected_rows(format(
    'insert into public.professional_breaks (company_id, professional_id, start_time, end_time) values (%L, %L, %L, %L)',
    :'company_a_id', :'professional_a2_id', '13:00', '14:00'
  )),
  'the same break window is fine for a different professional (A2)');

-- ---------------------------------------------------------------------
-- 3. get_available_slots() excludes both break windows, but still
-- offers the slots immediately touching their edges.
-- ---------------------------------------------------------------------
select coalesce(jsonb_agg(slot_start order by slot_start), '[]'::jsonb) as slots
from public.get_available_slots(:'company_a_id'::uuid, :'professional_a_id'::uuid, :'service_a_id'::uuid, current_date + 1)
\gset

select test.assert(
  :'slots'::jsonb @> '["12:15:00"]'::jsonb,
  '12:15 (ends exactly at 13:00, touching but not overlapping the lunch break) is offered'
);
select test.assert(
  not (:'slots'::jsonb @> '["12:30:00"]'::jsonb),
  '12:30 (would end at 13:15, inside the lunch break) is not offered'
);
select test.assert(
  :'slots'::jsonb @> '["14:00:00"]'::jsonb,
  '14:00 (starts exactly when the lunch break ends) is offered'
);
select test.assert(
  :'slots'::jsonb @> '["14:30:00"]'::jsonb,
  '14:30 (ends exactly at 15:15, touching but not overlapping the afternoon break) is offered'
);
select test.assert(
  not (:'slots'::jsonb @> '["14:45:00"]'::jsonb),
  '14:45 (would end at 15:30, overlapping the afternoon break) is not offered'
);
select test.assert(
  :'slots'::jsonb @> '["15:30:00"]'::jsonb,
  '15:30 (starts exactly when the afternoon break ends) is offered'
);

-- The public (anon) wrapper must agree — it delegates straight to
-- get_available_slots(), so the same break windows must be excluded
-- there too.
select slug from public.companies where id = :'company_a_id'::uuid \gset a_
select test.act_as_anon();

select coalesce(jsonb_agg(slot_start order by slot_start), '[]'::jsonb) as slots
from public.get_public_available_slots(:'a_slug', :'professional_a_id'::uuid, :'service_a_id'::uuid, current_date + 1)
\gset public_

select test.assert(
  not (:'public_slots'::jsonb @> '["13:15:00"]'::jsonb),
  'the public booking page never offers a slot inside Carlos''s lunch break either'
);

select test.act_as(:'owner_a_id'::uuid);

-- ---------------------------------------------------------------------
-- 4. The database itself rejects an appointment landing inside a
-- break, even if something bypassed the UI and get_available_slots()
-- entirely — the real backstop, same as business hours and
-- time_blocks.
-- ---------------------------------------------------------------------
select test.assert_denied(
  format(
    'insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by) values (%L, %L, %L, %L, %L, %L, %L)',
    :'company_a_id', :'customer_a_id', :'professional_a_id', :'service_a_id',
    ((current_date + 1 + interval '13 hour 15 minute') at time zone 'America/Sao_Paulo')::text,
    ((current_date + 1 + interval '14 hour') at time zone 'America/Sao_Paulo')::text, :'owner_a_id'
  ),
  'an appointment landing inside Carlos''s lunch break is rejected by the database, not just hidden from availability');

-- A back-to-back appointment starting exactly when the break ends is
-- still allowed.
select test.assert_row_count(1,
  test.exec_affected_rows(format(
    'insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by) values (%L, %L, %L, %L, %L, %L, %L)',
    :'company_a_id', :'customer_a_id', :'professional_a_id', :'service_a_id',
    ((current_date + 1 + interval '14 hour') at time zone 'America/Sao_Paulo')::text,
    ((current_date + 1 + interval '14 hour 45 minute') at time zone 'America/Sao_Paulo')::text, :'owner_a_id'
  )),
  'an appointment starting exactly when the lunch break ends is accepted');

-- ---------------------------------------------------------------------
-- 5. Cross-company isolation: company B can neither see nor write
-- Carlos's (company A) breaks.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_b_id'::uuid);

select count(*) as n from public.professional_breaks where professional_id = :'professional_a_id'::uuid \gset crossread_
select test.assert_row_count(0, :crossread_n, 'owner B cannot see company A''s professional breaks at all');

select test.assert_denied(
  format(
    'insert into public.professional_breaks (company_id, professional_id, start_time, end_time) values (%L, %L, %L, %L)',
    :'company_a_id', :'professional_a_id', '09:00', '09:15'
  ),
  'owner B cannot insert a break tagged with company A''s id (fails the write policy)');

select test.assert_denied(
  format(
    'insert into public.professional_breaks (company_id, professional_id, start_time, end_time) values (%L, %L, %L, %L)',
    :'company_b_id', :'professional_a_id', '09:00', '09:15'
  ),
  'owner B cannot link a break to company A''s professional even tagged with their own company id (composite FK rejects the mismatch)');

-- A plain professional (not owner) cannot manage breaks either — same
-- "owner writes, company reads" rule as business_hours/time_blocks.
select test.act_as(:'prof_a_user_id'::uuid);

select test.assert_denied(
  format(
    'insert into public.professional_breaks (company_id, professional_id, start_time, end_time) values (%L, %L, %L, %L)',
    :'company_a_id', :'professional_a_id', '09:00', '09:15'
  ),
  'professional A (not owner) cannot schedule their own break');

select test.act_as_superuser();

select test.assert(true, 'professional breaks: availability, overlap guard, business-hours-style enforcement and cross-company isolation all verified');
