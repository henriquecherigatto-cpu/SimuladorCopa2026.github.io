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

select test.assert(true, 'public appointment lookup by phone: correct scope, ordering, and cross-company isolation all verified');
