-- The platform admin must see cross-company operational data
-- (companies, memberships, subscriptions, billing, audit log) but
-- must NOT get a blanket bypass onto end-customer data (professionals,
-- services, customers, appointments) it has no operational need for —
-- this is an explicit requirement from the brief, not just an
-- implementation detail.
select test.act_as(:'outsider_id'::uuid);

select test.assert(
  (select is_platform_admin from public.profiles where id = :'outsider_id'::uuid),
  'sanity check: the test admin really is flagged is_platform_admin');

-- CAN see both companies, both subscriptions, both memberships.
select test.assert_row_count(2, count(*), 'admin can see both companies')
  from public.companies where id in (:'company_a_id'::uuid, :'company_b_id'::uuid);

select test.assert_row_count(2, count(*), 'admin can see both companies'' subscriptions')
  from public.subscriptions where company_id in (:'company_a_id'::uuid, :'company_b_id'::uuid);

select test.assert_row_count(5, count(*), 'admin can see all company_members rows across both companies')
  from public.company_members where company_id in (:'company_a_id'::uuid, :'company_b_id'::uuid);

select test.assert(count(*) > 0, 'admin can see audit log entries across companies')
  from public.audit_logs where company_id in (:'company_a_id'::uuid, :'company_b_id'::uuid);

-- CANNOT directly read either company's professionals, services,
-- customers or appointments — no admin bypass exists on those
-- policies, by design.
select test.assert_row_count(0, count(*), 'admin has NO direct read access to company A''s professionals')
  from public.professionals where company_id = :'company_a_id'::uuid;

select test.assert_row_count(0, count(*), 'admin has NO direct read access to company B''s professionals')
  from public.professionals where company_id = :'company_b_id'::uuid;

select test.assert_row_count(0, count(*), 'admin has NO direct read access to company A''s customers')
  from public.customers where company_id = :'company_a_id'::uuid;

select test.assert_row_count(0, count(*), 'admin has NO direct read access to company B''s customers')
  from public.customers where company_id = :'company_b_id'::uuid;

select test.assert_row_count(0, count(*), 'admin has NO direct read access to company A''s appointments')
  from public.appointments where company_id = :'company_a_id'::uuid;

select test.assert_row_count(0, count(*), 'admin has NO direct read access to company A''s services')
  from public.services where company_id = :'company_a_id'::uuid;

-- Instead, the admin dashboard gets its professional/customer counts
-- from the aggregated, admin-only RPCs — which DO work for an admin.
select test.assert(
  (select count(*) from public.admin_company_overview()) = 2,
  'admin_company_overview() returns both companies'' aggregated stats');

select test.assert(
  (select professional_count from public.admin_company_overview() where company_name = 'Barber 013') = 2,
  'admin_company_overview() correctly counts company A''s 2 active professionals without row-level access to the professionals table');

select test.assert(
  (select customer_count from public.admin_company_overview() where company_name = 'Barber 013') = 1,
  'admin_company_overview() correctly counts company A''s 1 customer');

select test.assert(
  (select total_companies from public.admin_platform_metrics()) = 2,
  'admin_platform_metrics() reports the right total company count');

-- The admin can update a company's own record (support operations)
-- and a subscription's status (e.g. manually reactivating after a
-- confirmed payment) — these ARE within the admin's legitimate scope.
select test.assert_row_count(1,
  test.exec_affected_rows(format('update public.subscriptions set status = %L where company_id = %L', 'ativa', :'company_a_id')),
  'admin CAN update a company''s subscription status');

select test.act_as_superuser();
