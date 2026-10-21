-- Removes the Profissional (R$49,90) plan from sale, requested by the
-- platform owner — only one tier (Essencial, R$24,90) is offered now.
-- Deactivated rather than deleted, same reasoning as Studio in
-- 20260101000024_two_plan_tiers.sql: plans.id has no ON DELETE
-- CASCADE/SET NULL from subscriptions.plan_id, so deleting a plan
-- with even one subscriber would fail outright, and any company
-- already on it must keep working exactly as before. `active = false`
-- is what plans_select's own RLS policy and /plano's own query already
-- use to mean "no longer offered" — the "Planos disponíveis" list and
-- create_company_with_owner()'s "cheapest active plan" pick (still
-- Essencial, the only one left) are both unaffected by this on their
-- own. The admin's plan-change tooling still sees and can assign it,
-- same as Studio today.

update public.plans
set active = false
where name = 'Profissional';
