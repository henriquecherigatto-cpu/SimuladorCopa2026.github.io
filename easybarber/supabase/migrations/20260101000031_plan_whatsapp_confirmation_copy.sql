-- Item 14 (user request): the Profissional plan's own feature list
-- didn't say anywhere that it includes the automated WhatsApp booking
-- confirmation to the CUSTOMER (whatsapp_confirmations_included, see
-- 20260101000026_whatsapp_plan_gating_and_subscription_alerts.sql) —
-- only the unrelated "Suporte via WhatsApp" (platform support to the
-- owner) was listed, which reads as the same feature but isn't.
update public.plans
set features = '["Tudo do plano Essencial", "Até 10 profissionais", "Confirmação automática do agendamento via WhatsApp para o cliente", "Lembretes automáticos", "Relatórios avançados", "Suporte prioritário", "Suporte via WhatsApp"]'::jsonb
where name = 'Profissional';
