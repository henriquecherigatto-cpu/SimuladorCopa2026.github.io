-- Seed the commercial catalogue. These are real rows the admin can
-- edit later (price, features, limits) — not values hard-coded
-- elsewhere in the app.
insert into public.plans (name, price_cents, features, max_professionals, max_customers) values
  (
    'Essencial',
    2490,
    '["Agenda de agendamentos", "Até 3 profissionais", "Clientes ilimitados", "Suporte por e-mail"]'::jsonb,
    3,
    null
  ),
  (
    'Profissional',
    4990,
    '["Tudo do plano Essencial", "Até 10 profissionais", "Lembretes automáticos", "Relatórios avançados", "Suporte prioritário"]'::jsonb,
    10,
    null
  ),
  (
    'Studio',
    8990,
    '["Tudo do plano Profissional", "Profissionais ilimitados", "Múltiplas unidades", "Suporte via WhatsApp"]'::jsonb,
    null,
    null
  );
