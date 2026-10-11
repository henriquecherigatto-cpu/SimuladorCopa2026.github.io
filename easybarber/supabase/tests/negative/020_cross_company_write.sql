-- Owner A must not be able to WRITE anything belonging to Company B,
-- nor create rows that would cross the tenant boundary.
select test.act_as(:'owner_a_id'::uuid);

-- UPDATE/DELETE targeting a row RLS hides: affects zero rows, no
-- error raised (this is standard Postgres RLS behaviour, and is the
-- correct thing to assert).
select test.assert_row_count(0,
  test.exec_affected_rows(format('update public.companies set name = %L where id = %L', 'Hijacked', :'company_b_id')),
  'owner A updating company B''s name affects 0 rows');

select test.assert_row_count(0,
  test.exec_affected_rows(format('update public.customers set phone = %L where id = %L', '0000000000', :'customer_b_id')),
  'owner A updating company B''s customer affects 0 rows');

select test.assert_row_count(0,
  test.exec_affected_rows(format('delete from public.customers where id = %L', :'customer_b_id')),
  'owner A deleting company B''s customer affects 0 rows');

select test.assert_row_count(0,
  test.exec_affected_rows(format('update public.appointments set status = %L where id = %L', 'cancelado', :'appointment_b_id')),
  'owner A cancelling company B''s appointment affects 0 rows');

select test.assert_row_count(0,
  test.exec_affected_rows(format('update public.professionals set active = false where id = %L', :'professional_b_id')),
  'owner A deactivating company B''s professional affects 0 rows');

-- Creating a company directly (bypassing create_company_with_owner)
-- must be rejected outright — there is no insert policy for it.
select test.assert_denied(
  format('insert into public.companies (name, phone, created_by) values (%L, %L, %L)', 'Shadow Co', '000', :'owner_a_id'),
  'owner A cannot INSERT a company directly, bypassing create_company_with_owner()');

-- Granting themselves membership in company B must be rejected.
select test.assert_denied(
  format('insert into public.company_members (company_id, profile_id, role) values (%L, %L, %L)', :'company_b_id', :'owner_a_id', 'owner'),
  'owner A cannot grant themselves membership in company B');

-- Creating a customer "as" company B (company_id spoofed) must be
-- rejected by the INSERT policy's WITH CHECK.
select test.assert_denied(
  format('insert into public.customers (company_id, name, phone) values (%L, %L, %L)', :'company_b_id', 'Fake Customer', '123'),
  'owner A cannot INSERT a customer row tagged with company B''s id');

-- Booking an appointment under A''s own company but with B''s
-- professional must be rejected by the composite foreign key
-- (appointments_same_company_professional), even though company_id
-- itself is A''s own and would otherwise pass the RLS check.
select test.assert_denied(
  format(
    'insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by) values (%L, %L, %L, %L, %L, %L, %L)',
    :'company_a_id', :'customer_a_id', :'professional_b_id', :'service_a_id',
    (current_date + 2 + interval '10 hour')::text, (current_date + 2 + interval '10 hour 45 minute')::text, :'owner_a_id'
  ),
  'owner A cannot book an appointment against company B''s professional, even tagged with company A''s own id');

-- Linking A''s professional to B''s service must be rejected by the
-- professional_services "same company" trigger, which is a second
-- layer of defense beyond RLS (RLS alone only checks the
-- professional's company, not the service's).
select test.assert_denied(
  format('insert into public.professional_services (professional_id, service_id) values (%L, %L)', :'professional_a_id', :'service_b_id'),
  'owner A cannot link their professional to company B''s service');

-- A company owner can never grant their own subscription "ativa"
-- status directly — only an admin (or the service-role billing
-- webhook) may change it.
select test.assert_row_count(0,
  test.exec_affected_rows(format('update public.subscriptions set status = %L where company_id = %L', 'ativa', :'company_a_id')),
  'owner A cannot self-approve their own subscription to "ativa"');

-- Professional A (not an owner) can view their own appointment but
-- may only change status/notes on it — not reassign the customer.
select test.act_as(:'prof_a_user_id'::uuid);

select test.assert_denied(
  format('update public.appointments set customer_id = %L where id = %L', :'customer_b_id', :'appointment_a_id'),
  'professional A cannot reassign the customer on their own appointment');

-- Professional A cannot touch their teammate''s (professional A2)
-- appointment at all — the row is invisible to them under RLS, so
-- the UPDATE matches zero rows.
select test.assert_row_count(0,
  test.exec_affected_rows(format('update public.appointments set status = %L where id = %L', 'confirmado', :'appointment_a2_id')),
  'professional A updating teammate professional A2''s appointment affects 0 rows');

-- Professional A has no delete rights on customers at all (owner-only).
select test.assert_row_count(0,
  test.exec_affected_rows(format('delete from public.customers where id = %L', :'customer_a_id')),
  'professional A deleting their own company''s customer affects 0 rows (owner-only)');

select test.act_as_superuser();
