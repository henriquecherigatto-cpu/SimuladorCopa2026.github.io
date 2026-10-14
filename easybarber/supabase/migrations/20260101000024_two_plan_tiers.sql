-- Commercial catalogue change, requested by the platform owner: down
-- to two plan tiers (R$24,90 and R$49,90), both now including
-- WhatsApp support as a listed feature (previously only the top
-- "Studio" tier had it).
--
-- Studio is deactivated rather than deleted: `plans.id` has no
-- ON DELETE CASCADE/SET NULL from subscriptions.plan_id, so deleting
-- a plan with even one real subscriber would fail outright — and even
-- if it didn't, a company already on Studio must keep working exactly
-- as before. `active = false` is what plans_select's own RLS policy
-- already uses to mean "no longer offered to new signups" (admin
-- still sees it via admin_company_overview()/the plans table, same as
-- today — see the comment on 20260101000012_seed_plans.sql), while
-- create_company_with_owner()'s "cheapest active plan" pick is
-- unaffected either way (Essencial was and remains the cheapest).
update public.plans
set active = false
where price_cents not in (2490, 4990);

update public.plans
set price_cents = 2490,
    features = '["Agenda de agendamentos", "Até 3 profissionais", "Clientes ilimitados", "Suporte por e-mail", "Suporte via WhatsApp"]'::jsonb
where name = 'Essencial';

update public.plans
set price_cents = 4990,
    features = '["Tudo do plano Essencial", "Até 10 profissionais", "Lembretes automáticos", "Relatórios avançados", "Suporte prioritário", "Suporte via WhatsApp"]'::jsonb
where name = 'Profissional';
