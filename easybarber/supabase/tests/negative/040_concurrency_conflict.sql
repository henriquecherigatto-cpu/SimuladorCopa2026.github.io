-- The database itself (not application code) must refuse a second
-- appointment that overlaps an existing one for the same
-- professional — this is what makes double-booking impossible even
-- if two requests race each other, which no amount of "check first,
-- then insert" application logic can fully guarantee under
-- concurrency. We can't literally run two requests at the exact same
-- instant from a single psql script, but the exclusion constraint
-- that makes this safe is unconditional — it would reject the second
-- insert here or in a true race, identically.
select test.act_as(:'owner_a_id'::uuid);

-- Exact same slot as the existing appointment_a (day+1, 10:00-10:45).
select test.assert_denied(
  format(
    'insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by) values (%L, %L, %L, %L, %L, %L, %L)',
    :'company_a_id', :'customer_a_id', :'professional_a_id', :'service_a_id',
    (current_date + 1 + interval '10 hour')::text, (current_date + 1 + interval '10 hour 45 minute')::text, :'owner_a_id'
  ),
  'an identical-slot double-booking for professional A is rejected by the database');

-- Partially overlapping slot (10:30-11:15 overlaps the 10:00-10:45
-- appointment) is rejected too — not just exact duplicates.
select test.assert_denied(
  format(
    'insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by) values (%L, %L, %L, %L, %L, %L, %L)',
    :'company_a_id', :'customer_a_id', :'professional_a_id', :'service_a_id',
    (current_date + 1 + interval '10 hour 30 minute')::text, (current_date + 1 + interval '11 hour 15 minute')::text, :'owner_a_id'
  ),
  'a partially overlapping booking for professional A is rejected by the database');

-- A back-to-back booking (starts exactly when the other ends) is
-- allowed — 10:45 to 11:30 does not overlap 10:00-10:45.
select test.assert_row_count(1,
  test.exec_affected_rows(format(
    'insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by) values (%L, %L, %L, %L, %L, %L, %L)',
    :'company_a_id', :'customer_a_id', :'professional_a_id', :'service_a_id',
    (current_date + 1 + interval '10 hour 45 minute')::text, (current_date + 1 + interval '11 hour 30 minute')::text, :'owner_a_id'
  )),
  'a back-to-back (non-overlapping) booking for professional A is accepted');

-- The same slot is fine for a DIFFERENT professional (A2) — the
-- exclusion constraint is scoped per professional_id, not per company.
select test.assert_row_count(1,
  test.exec_affected_rows(format(
    'insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by) values (%L, %L, %L, %L, %L, %L, %L)',
    :'company_a_id', :'customer_a_id', :'professional_a2_id', :'service_a_id',
    (current_date + 1 + interval '10 hour')::text, (current_date + 1 + interval '10 hour 45 minute')::text, :'owner_a_id'
  )),
  'the same time slot is fine for a different professional (A2)');

-- A cancelled appointment does not block a new booking over the same
-- slot — cancel the 10:45-11:30 one just created, then rebook it.
update public.appointments
set status = 'cancelado'
where company_id = :'company_a_id'::uuid
  and professional_id = :'professional_a_id'::uuid
  and starts_at = (current_date + 1 + interval '10 hour 45 minute');

select test.assert_row_count(1,
  test.exec_affected_rows(format(
    'insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by) values (%L, %L, %L, %L, %L, %L, %L)',
    :'company_a_id', :'customer_a_id', :'professional_a_id', :'service_a_id',
    (current_date + 1 + interval '10 hour 45 minute')::text, (current_date + 1 + interval '11 hour 30 minute')::text, :'owner_a_id'
  )),
  'a cancelled appointment frees up its slot for rebooking');

select test.act_as_superuser();
