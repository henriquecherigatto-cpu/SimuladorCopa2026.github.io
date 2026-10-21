-- Covers 20260101000033_admin_plan_change.sql: admin_company_overview()
-- now exposes plan_id, and the new admin_update_company_plan() lets
-- the platform admin move a company between plans (e.g. Essencial ->
-- Profissional) with an atomic audit log entry — a plan_id change on
-- subscriptions doesn't trip audit_subscription_change() (it only
-- watches `status`, see 20260101000008_audit_logs.sql), so this RPC is
-- the only path that gets both right together, same shape as
-- admin_update_plan_price() in 20260101000023_admin_analytics.sql.
--
-- Doesn't assume which plan company A starts on (several earlier test
-- files already touch its subscription) — only that the RPC moves it
-- to a DIFFERENT, named active plan, and that company B's own plan is
-- untouched by it.
--
-- Doesn't assume the commercial catalogue has a second active plan
-- either (20260101000047_deactivate_profissional_plan.sql left only
-- Essencial active) — inserts its own throwaway active plan to move
-- into, so this test's coverage of the success path never depends on
-- how many real plans happen to be on sale.

select test.act_as_superuser();

select s.plan_id, p.name as old_plan_name
from public.subscriptions s
join public.plans p on p.id = s.plan_id
where s.company_id = :'company_a_id'::uuid \gset pc_

insert into public.plans (name, price_cents, features, active)
values ('Plano Teste 160', 1000, '[]'::jsonb, true)
returning id as other_plan_id, name as other_plan_name \gset pc_

select test.assert(
  :'pc_other_plan_id' is not null,
  'fixture sanity: the throwaway second active plan was inserted for company A to be moved into'
);

select plan_id as company_b_plan_id_before
from public.subscriptions
where company_id = :'company_b_id'::uuid \gset cb_

-- ---------------------------------------------------------------------
-- 1. Only a platform admin can call admin_update_company_plan().
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select test.assert_denied(
  format('select public.admin_update_company_plan(%L, %L)', :'company_a_id', :'pc_other_plan_id'),
  'an ordinary company owner cannot call admin_update_company_plan() — platform admin only'
);

-- ---------------------------------------------------------------------
-- 2. Rejects an unknown/inactive plan id and a company with no
-- subscription, rather than silently no-op'ing.
-- ---------------------------------------------------------------------
select test.act_as(:'outsider_id'::uuid);
select test.assert_denied(
  format('select public.admin_update_company_plan(%L, gen_random_uuid())', :'company_a_id'),
  'admin_update_company_plan() rejects a plan id that does not exist'
);
select test.assert_denied(
  format('select public.admin_update_company_plan(gen_random_uuid(), %L)', :'pc_other_plan_id'),
  'admin_update_company_plan() rejects a company id with no subscription row'
);

-- ---------------------------------------------------------------------
-- 3. The platform admin can move company A to the other plan; the
-- write and the audit log land atomically.
-- ---------------------------------------------------------------------
select public.admin_update_company_plan(:'company_a_id'::uuid, :'pc_other_plan_id'::uuid);

select test.act_as_superuser();
select test.assert(
  (select plan_id from public.subscriptions where company_id = :'company_a_id'::uuid) = :'pc_other_plan_id'::uuid,
  'admin_update_company_plan() actually moves company A to the new plan_id'
);
select test.assert(
  exists (
    select 1 from public.audit_logs
    where action = 'company_plan_changed'
      and target_id = :'company_a_id'::uuid
      and metadata ->> 'from_plan' = :'pc_old_plan_name'
      and metadata ->> 'to_plan' = :'pc_other_plan_name'
  ),
  'admin_update_company_plan() writes an audit log entry naming both the old and new plan'
);
select test.assert(
  (select plan_id from public.subscriptions where company_id = :'company_b_id'::uuid) = :'cb_company_b_plan_id_before'::uuid,
  'company B''s own plan is untouched by company A''s plan change — no cross-company leakage'
);

-- ---------------------------------------------------------------------
-- 4. admin_company_overview() now reports the new plan_id/plan_name
-- for company A.
-- ---------------------------------------------------------------------
select test.act_as(:'outsider_id'::uuid);
select plan_id, plan_name
from public.admin_company_overview()
where company_name = 'Barber 013' \gset ov_

select test.assert(
  :'ov_plan_id' = :'pc_other_plan_id',
  'admin_company_overview() exposes plan_id, and it reflects the just-applied plan change for company A'
);
select test.assert(
  :'ov_plan_name' = :'pc_other_plan_name',
  'admin_company_overview() plan_name matches the new plan for company A'
);

select test.act_as_superuser();

select test.assert(true, 'admin plan change verified: platform-admin-only, rejects an unknown plan or a company with no subscription, writes the subscription + audit log atomically, admin_company_overview() reflects it, and company B stays untouched');
