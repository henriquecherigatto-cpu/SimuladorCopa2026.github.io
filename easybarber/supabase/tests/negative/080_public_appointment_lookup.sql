-- "Consultar meu agendamento" (20260101000019_public_appointment_lookup.sql):
-- get_public_customer_appointments(slug, phone) is the only door —
-- scoped to one company via its slug, matched by phone, and must
-- never return another company's appointments even when the same
-- phone number happens to belong to a customer there too.
--
-- Reuses 000_fixtures.sql: customer A ("Cliente A", phone
-- 19999990004) has TWO appointments in company A ("Barber 013") —
-- appointment_a_id at 10h and appointment_a2_id at 14h, both
-- current_date + 1. Customer B ("Cliente B", phone 19999990006) has
-- one appointment in company B ("Navalha Club").

select test.act_as_superuser();

select slug from public.companies where id = :'company_a_id'::uuid \gset a_
select slug from public.companies where id = :'company_b_id'::uuid \gset b_

-- Two more appointments for Cliente A, local to this file (not shared
-- 000_fixtures.sql state, since 100/120/130/140_*.sql later in the
-- suite still reference appointment_a_id/appointment_a2_id and must
-- not see them cancelled): one in the past (date-filter coverage,
-- section 4), one safely in the future (cancel-by-phone mutation
-- coverage, section 5) — both on dates no other test file touches.
insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by)
values (
  :'company_a_id'::uuid, :'customer_a_id'::uuid, :'professional_a_id'::uuid, :'service_a_id'::uuid,
  ((current_date - 10 + interval '11 hour') at time zone 'America/Sao_Paulo'),
  ((current_date - 10 + interval '11 hour 45 minute') at time zone 'America/Sao_Paulo'),
  :'owner_a_id'::uuid
)
returning id as appointment_a_past_id \gset

-- 09:00 on the same current_date + 1 as appointment_a_id/appointment_a2_id
-- (10h/14h) and 040_concurrency_conflict.sql's own slots (10h-11h30) —
-- deliberately BEFORE all of them, not after, so it never becomes the
-- "most recent" appointment and never disturbs section 1's ordering
-- assertion (desc by starts_at, expects the 14h one first).
insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by)
values (
  :'company_a_id'::uuid, :'customer_a_id'::uuid, :'professional_a_id'::uuid, :'service_a_id'::uuid,
  ((current_date + 1 + interval '9 hour') at time zone 'America/Sao_Paulo'),
  ((current_date + 1 + interval '9 hour 45 minute') at time zone 'America/Sao_Paulo'),
  :'owner_a_id'::uuid
)
returning id as appointment_a_cancel_test_id \gset

select test.act_as_anon();

-- ---------------------------------------------------------------------
-- 1. A real lookup returns both of this customer's appointments for
-- this company, most recent first.
-- ---------------------------------------------------------------------
select id, service_name, professional_name, status
from public.get_public_customer_appointments(:'a_slug', '19999990004')
order by starts_at desc
limit 1 \gset first_

select test.assert(:'first_id' = :'appointment_a2_id', 'the later appointment (14h) is returned first, ordered by starts_at desc');
select test.assert(:'first_professional_name' = 'João (A2)', 'professional_name for the 14h appointment matches professional A2');

-- Not an exact total count: 040_concurrency_conflict.sql (run earlier
-- in this same shared session — see run_all.sql) inserts a few more
-- appointments for this same customer/company while exercising the
-- overlap exclusion constraint. What matters here is that BOTH of
-- this customer's original fixture appointments are present.
select count(*) as n from public.get_public_customer_appointments(:'a_slug', '19999990004')
where id in (:'appointment_a_id'::uuid, :'appointment_a2_id'::uuid) \gset count_
select test.assert_row_count(2, :count_n, 'both of Cliente A''s fixture appointments are present in her lookup results');

-- ---------------------------------------------------------------------
-- 2. An unknown phone number returns an empty result, not an error.
-- ---------------------------------------------------------------------
select count(*) as n from public.get_public_customer_appointments(:'a_slug', '00000000000') \gset unknown_
select test.assert_row_count(0, :unknown_n, 'a phone number with no bookings returns an empty list, no error');

-- An unknown slug behaves the same way.
select count(*) as n from public.get_public_customer_appointments('this-slug-does-not-exist', '19999990004') \gset badslug_
select test.assert_row_count(0, :badslug_n, 'an unknown slug returns an empty list, no error');

-- ---------------------------------------------------------------------
-- 3. Cross-company isolation: Cliente B's phone number, looked up
-- under COMPANY A's slug, must return nothing — even though that
-- phone genuinely belongs to a customer, just in a different company.
-- ---------------------------------------------------------------------
select count(*) as n from public.get_public_customer_appointments(:'a_slug', '19999990006') \gset crossa_
select test.assert_row_count(0, :crossa_n, 'company B''s customer phone number returns nothing when looked up under company A''s slug');

-- And the correct slug for that same phone does return company B's
-- own appointment, never company A's.
select id, service_name from public.get_public_customer_appointments(:'b_slug', '19999990006') \gset bresult_
select test.assert(:'bresult_id' = :'appointment_b_id', 'the correct slug for Cliente B returns company B''s own appointment');
select test.assert(:'bresult_service_name' = 'Barba', 'the returned appointment is company B''s (service "Barba"), not company A''s');

-- ---------------------------------------------------------------------
-- 4. Date filter (20260101000029_public_lookup_cancel_and_date_filter.sql):
-- a past appointment never appears, even though it's this same
-- customer's own, in this same company. The future fixture appointments
-- (today's lookup results) all come back with can_cancel = true.
-- ---------------------------------------------------------------------
select count(*) as n from public.get_public_customer_appointments(:'a_slug', '19999990004')
where id = :'appointment_a_past_id'::uuid \gset past_
select test.assert_row_count(0, :past_n, 'a past appointment is never returned by the phone lookup, even for its own customer/company');

select can_cancel from public.get_public_customer_appointments(:'a_slug', '19999990004')
where id = :'appointment_a_cancel_test_id'::uuid \gset cancelflag_
select test.assert(:'cancelflag_can_cancel'::boolean is true, 'a future, not-yet-cancelled appointment comes back with can_cancel = true');

-- ---------------------------------------------------------------------
-- 5. cancel_public_appointment_by_phone(): phone + slug + appointment
-- id must all match the same row; idempotent on repeat calls, mirrors
-- cancel_appointment_by_token()'s own behavior.
-- ---------------------------------------------------------------------
select test.act_as_superuser();
select count(*) as n from public.appointments
where id = :'appointment_a_cancel_test_id'::uuid and status = 'cancelado' \gset precancel_

select test.act_as_anon();
select public.cancel_public_appointment_by_phone(:'a_slug', '00000000000', :'appointment_a_cancel_test_id'::uuid) ->> 'found' as found \gset wrongphone_
select test.assert(:'wrongphone_found'::boolean is false, 'the wrong phone number cannot cancel someone else''s appointment');

select public.cancel_public_appointment_by_phone(:'b_slug', '19999990004', :'appointment_a_cancel_test_id'::uuid) ->> 'found' as found \gset wrongslug_
select test.assert(:'wrongslug_found'::boolean is false, 'company A''s appointment cannot be cancelled by looking it up under company B''s slug, even with the right phone');

select test.act_as_superuser();
select count(*) as n from public.appointments
where id = :'appointment_a_cancel_test_id'::uuid and status = 'cancelado' \gset postwrong_
select test.assert(:postwrong_n = :precancel_n, 'the failed attempts above left the appointment untouched');

select test.act_as_anon();
select public.cancel_public_appointment_by_phone(:'a_slug', '19999990004', :'appointment_a_cancel_test_id'::uuid) as result \gset ok_
select test.assert(:'ok_result'::jsonb ->> 'found' = 'true', 'the correct phone + slug + appointment id cancels successfully');
select test.assert(:'ok_result'::jsonb ->> 'status' = 'cancelado', 'the returned status reflects the cancellation');

select test.act_as_superuser();
select status from public.appointments where id = :'appointment_a_cancel_test_id'::uuid \gset verify_
select test.assert(:'verify_status' = 'cancelado', 'the appointment row itself is actually updated to cancelado');

select test.act_as_anon();

-- Idempotent: calling it again just returns the current (already
-- cancelled) state, no error.
select public.cancel_public_appointment_by_phone(:'a_slug', '19999990004', :'appointment_a_cancel_test_id'::uuid) as result \gset again_
select test.assert(:'again_result'::jsonb ->> 'found' = 'true', 'calling cancel again on an already-cancelled appointment is a safe no-op, not an error');
select test.assert(:'again_result'::jsonb ->> 'status' = 'cancelado', 'and it still reports the (unchanged) cancelado status');

-- The now-cancelled appointment no longer offers can_cancel on a fresh lookup.
select can_cancel from public.get_public_customer_appointments(:'a_slug', '19999990004')
where id = :'appointment_a_cancel_test_id'::uuid \gset aftercancel_
select test.assert(:'aftercancel_can_cancel'::boolean is false, 'a cancelled appointment no longer reports can_cancel = true');

-- An unknown appointment id is a safe no-op too, not an error.
select public.cancel_public_appointment_by_phone(:'a_slug', '19999990004', gen_random_uuid()) ->> 'found' as found \gset unknownappt_
select test.assert(:'unknownappt_found'::boolean is false, 'an unknown appointment id returns found: false rather than erroring');

select test.assert(true, 'public appointment lookup by phone: correct scope, ordering, cross-company isolation, the today-or-later date filter, and phone-based cancellation (with its own slug+phone+id authorization check, idempotent) all verified');
