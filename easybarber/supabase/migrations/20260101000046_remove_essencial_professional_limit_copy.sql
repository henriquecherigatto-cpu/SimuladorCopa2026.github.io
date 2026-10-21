-- The platform owner doesn't want a professional-count limit implied
-- anywhere — there never was one actually enforced in code, but the
-- Essencial (R$24,90) plan's marketing copy listed "Até 3
-- profissionais" (20260101000024_two_plan_tiers.sql), which reads as
-- a cap. Drop that one line; everything else about the plan is
-- unchanged.

update public.plans
set features = '["Agenda de agendamentos", "Clientes ilimitados", "Suporte por e-mail", "Suporte via WhatsApp"]'::jsonb
where name = 'Essencial';
