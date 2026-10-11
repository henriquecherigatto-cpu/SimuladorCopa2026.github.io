-- Owner A must not be able to SELECT anything belonging to Company B,
-- across every tenant-scoped table.
select test.act_as(:'owner_a_id'::uuid);

select test.assert_row_count(0, count(*), 'owner A cannot select company B''s row from companies')
  from public.companies where id = :'company_b_id'::uuid;

select test.assert_row_count(1, count(*), 'owner A can still select their own company')
  from public.companies where id = :'company_a_id'::uuid;

select test.assert_row_count(0, count(*), 'owner A cannot select company B''s professionals')
  from public.professionals where company_id = :'company_b_id'::uuid;

select test.assert_row_count(0, count(*), 'owner A cannot select company B''s services')
  from public.services where company_id = :'company_b_id'::uuid;

select test.assert_row_count(0, count(*), 'owner A cannot select company B''s professional_services')
  from public.professional_services where professional_id = :'professional_b_id'::uuid;

select test.assert_row_count(0, count(*), 'owner A cannot select company B''s business_hours')
  from public.business_hours where company_id = :'company_b_id'::uuid;

select test.assert_row_count(0, count(*), 'owner A cannot select company B''s customers')
  from public.customers where company_id = :'company_b_id'::uuid;

select test.assert_row_count(0, count(*), 'owner A cannot select company B''s appointments')
  from public.appointments where company_id = :'company_b_id'::uuid;

select test.assert_row_count(0, count(*), 'owner A cannot select company B''s company_members')
  from public.company_members where company_id = :'company_b_id'::uuid;

select test.assert_row_count(0, count(*), 'owner A cannot select company B''s subscription')
  from public.subscriptions where company_id = :'company_b_id'::uuid;

select test.assert_row_count(1, count(*), 'owner A CAN select their own subscription')
  from public.subscriptions where company_id = :'company_a_id'::uuid;

-- A direct lookup by primary key must also come back empty — proves
-- the filtering is row-level, not just "doesn't show up in a list".
select test.assert_row_count(0, count(*), 'owner A cannot select company B''s customer by id')
  from public.customers where id = :'customer_b_id'::uuid;

select test.assert_row_count(0, count(*), 'owner A cannot select company B''s appointment by id')
  from public.appointments where id = :'appointment_b_id'::uuid;

-- Professional A (not an owner) should see only THEIR OWN
-- appointment, not even their teammate's (professional A2) one, and
-- certainly not company B's.
select test.act_as(:'prof_a_user_id'::uuid);

select test.assert_row_count(1, count(*), 'professional A sees exactly their own appointment')
  from public.appointments where company_id = :'company_a_id'::uuid;

select test.assert_row_count(0, count(*), 'professional A cannot see teammate professional A2''s appointment')
  from public.appointments where id = :'appointment_a2_id'::uuid;

select test.assert_row_count(0, count(*), 'professional A cannot see company B''s appointment')
  from public.appointments where id = :'appointment_b_id'::uuid;

-- A professional CAN see the company's shared catalogue data (their
-- own company's customers/services/professionals), just not another
-- company's.
select test.assert_row_count(1, count(*), 'professional A can see their own company''s customer record')
  from public.customers where id = :'customer_a_id'::uuid;

select test.assert_row_count(0, count(*), 'professional A cannot see company B''s customer record')
  from public.customers where id = :'customer_b_id'::uuid;

-- An outsider with NO membership anywhere (and not an admin yet at
-- this point — we promote outsider_id to admin only in fixtures,
-- so use a fresh unrelated id here) sees nothing at all.
select test.act_as(gen_random_uuid());

select test.assert_row_count(0, count(*), 'a user with no membership anywhere sees zero companies')
  from public.companies;

select test.assert_row_count(0, count(*), 'a user with no membership anywhere sees zero customers')
  from public.customers;

select test.assert_row_count(0, count(*), 'a user with no membership anywhere sees zero appointments')
  from public.appointments;

-- An anonymous (unauthenticated) request must also be rejected
-- outright — anon was never granted table access at all (see
-- 20260101000014_grants.sql, which only grants to `authenticated`),
-- so this is a permission-denied error, not just an empty result.
select test.act_as_anon();

select test.assert_denied('select * from public.companies', 'anonymous request to read companies is denied');
select test.assert_denied('select * from public.customers', 'anonymous request to read customers is denied');
select test.assert_denied('select * from public.appointments', 'anonymous request to read appointments is denied');

select test.act_as_superuser();
