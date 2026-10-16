-- The Profissional plan's features list already opens with "Tudo do
-- plano Essencial" (20260101000024_two_plan_tiers.sql), which already
-- implies everything Essencial lists, "Suporte via WhatsApp" included
-- — repeating it as its own bullet on the Profissional card was
-- redundant. Essencial's own listing is untouched; it's the one
-- original, non-redundant mention.

update public.plans
set features = '["Tudo do plano Essencial", "Até 10 profissionais", "Lembretes automáticos", "Relatórios avançados", "Suporte prioritário"]'::jsonb
where name = 'Profissional';
