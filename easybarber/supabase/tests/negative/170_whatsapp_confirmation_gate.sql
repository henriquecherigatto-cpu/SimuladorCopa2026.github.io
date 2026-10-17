-- Covers 20260101000034_whatsapp_confirmation_subscription_gate.sql:
-- whatsapp_confirmation_allowed() must be true only when BOTH the plan
-- includes WhatsApp confirmations AND the subscription is actually
-- ativa — not just the right plan. This is the exact gap the function
-- exists to close (the old check only ever looked at the plan).
--
-- Explicitly sets each company's plan_id/status for every case rather
-- than trusting whatever an earlier file in the suite left company
-- A/B in, so this file's outcome never depends on test ordering.

select test.act_as_superuser();

select id as essencial_id from public.plans where name = 'Essencial' \gset plan_
select id as profissional_id from public.plans where name = 'Profissional' \gset plan_

-- ---------------------------------------------------------------------
-- 1. Profissional plan + ativa subscription -> allowed. (Required
-- test: "Uma barbearia do plano Profissional ativo consegue enviar
-- uma confirmação.")
-- ---------------------------------------------------------------------
update public.subscriptions
set plan_id = :'plan_profissional_id'::uuid, status = 'ativa'
where company_id = :'company_a_id'::uuid;

select public.whatsapp_confirmation_allowed(:'appointment_a_id'::uuid) as allowed \gset case1_
select test.assert(
  :'case1_allowed'::boolean is true,
  'Profissional plan + ativa subscription: whatsapp_confirmation_allowed() is true'
);

-- ---------------------------------------------------------------------
-- 2. Lower plan (Essencial), even with an ativa subscription -> blocked,
-- confirmed by calling the function directly (there is no other gate
-- in front of it — this backend check IS "the endpoint"). (Required
-- test: "Uma barbearia de plano inferior não consegue enviar
-- mensagens, mesmo chamando diretamente o endpoint.")
-- ---------------------------------------------------------------------
update public.subscriptions
set plan_id = :'plan_essencial_id'::uuid, status = 'ativa'
where company_id = :'company_a_id'::uuid;

select public.whatsapp_confirmation_allowed(:'appointment_a_id'::uuid) as allowed \gset case2_
select test.assert(
  :'case2_allowed'::boolean is false,
  'Essencial plan (even with an ativa subscription) is blocked, called directly'
);

-- ---------------------------------------------------------------------
-- 3. Profissional plan but subscription NOT ativa (every other status)
-- -> blocked in every case. (Required test: "Uma assinatura vencida ou
-- suspensa bloqueia o envio" — covers every status the old, plan-only
-- check let through.)
-- ---------------------------------------------------------------------
update public.subscriptions set plan_id = :'plan_profissional_id'::uuid where company_id = :'company_a_id'::uuid;

update public.subscriptions set status = 'pendente' where company_id = :'company_a_id'::uuid;
select public.whatsapp_confirmation_allowed(:'appointment_a_id'::uuid) as allowed \gset pendente_
select test.assert(:'pendente_allowed'::boolean is false, 'Profissional plan + pendente subscription is blocked');

update public.subscriptions set status = 'tolerancia' where company_id = :'company_a_id'::uuid;
select public.whatsapp_confirmation_allowed(:'appointment_a_id'::uuid) as allowed \gset tolerancia_
select test.assert(:'tolerancia_allowed'::boolean is false, 'Profissional plan + tolerancia (grace period) subscription is blocked');

update public.subscriptions set status = 'suspensa' where company_id = :'company_a_id'::uuid;
select public.whatsapp_confirmation_allowed(:'appointment_a_id'::uuid) as allowed \gset suspensa_
select test.assert(:'suspensa_allowed'::boolean is false, 'Profissional plan + suspensa subscription is blocked');

update public.subscriptions set status = 'cancelada' where company_id = :'company_a_id'::uuid;
select public.whatsapp_confirmation_allowed(:'appointment_a_id'::uuid) as allowed \gset cancelada_
select test.assert(:'cancelada_allowed'::boolean is false, 'Profissional plan + cancelada subscription is blocked');

-- ---------------------------------------------------------------------
-- 4. Cross-company isolation: company A eligible, company B not —
-- confirm B's own appointment stays blocked while A's is allowed, at
-- the same time. Proves the check is scoped to the appointment's own
-- company (derived server-side from the appointment row, never a
-- client-supplied company id) and company A being eligible never
-- leaks into company B's result. (Required test: "Alterar o
-- identificador da barbearia na requisição não permite utilizar o
-- recurso de outra empresa" — this function has no company-id
-- parameter to alter in the first place; this is the equivalent
-- isolation guarantee for its appointment-id-only signature.)
-- ---------------------------------------------------------------------
update public.subscriptions
set plan_id = :'plan_profissional_id'::uuid, status = 'ativa'
where company_id = :'company_a_id'::uuid;
update public.subscriptions
set plan_id = :'plan_essencial_id'::uuid, status = 'ativa'
where company_id = :'company_b_id'::uuid;

select public.whatsapp_confirmation_allowed(:'appointment_a_id'::uuid) as allowed \gset isolation_a_
select public.whatsapp_confirmation_allowed(:'appointment_b_id'::uuid) as allowed \gset isolation_b_

select test.assert(
  :'isolation_a_allowed'::boolean is true,
  'company A (Profissional+ativa) is allowed while company B is simultaneously ineligible'
);
select test.assert(
  :'isolation_b_allowed'::boolean is false,
  'company B (Essencial) stays blocked even though company A is eligible at the same time — no cross-company leakage'
);

-- ---------------------------------------------------------------------
-- 5. Fail-safe-deny: an appointment id that doesn't exist (or any
-- other missing-data case along the join — no subscription row, no
-- plan row) resolves to false via exists(), never an error and never
-- a default-true. This is the DB-side half of "a temporary failure
-- never allows the send"; the TS-side half is the explicit
-- `eligibilityError || eligible !== true` check in
-- sendBookingConfirmation() (src/lib/actions/public-booking.ts) itself
-- — not reachable from this SQL suite since the gate's one caller is
-- TypeScript. (Required test: "A indisponibilidade temporária do
-- serviço de consulta de assinatura não libera o envio indevidamente.")
-- ---------------------------------------------------------------------
select public.whatsapp_confirmation_allowed(gen_random_uuid()) as allowed \gset missing_
select test.assert(
  :'missing_allowed'::boolean is false,
  'a non-existent appointment id resolves to false, never an error or a default-true'
);

-- ---------------------------------------------------------------------
-- 6. Access control: service_role only, same as log_whatsapp_message().
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select test.assert_denied(
  format('select public.whatsapp_confirmation_allowed(%L)', :'appointment_a_id'),
  'an ordinary company owner cannot call whatsapp_confirmation_allowed() — service_role only'
);

select test.act_as_anon();
select test.assert_denied(
  format('select public.whatsapp_confirmation_allowed(%L)', :'appointment_a_id'),
  'anon cannot call whatsapp_confirmation_allowed() either'
);

-- The one real caller (sendBookingConfirmation() in
-- src/lib/actions/public-booking.ts) uses the service-role client —
-- confirm that role can actually call this, not just that the logic
-- is correct when grants don't apply (every case above ran as
-- superuser, which bypasses grants entirely and so never exercised
-- the grant itself).
select test.act_as_superuser();
update public.subscriptions
set plan_id = :'plan_profissional_id'::uuid, status = 'ativa'
where company_id = :'company_a_id'::uuid;

select test.act_as_service_role();
select public.whatsapp_confirmation_allowed(:'appointment_a_id'::uuid) as allowed \gset service_role_
select test.assert(
  :'service_role_allowed'::boolean is true,
  'service_role (the real caller''s own role) can call whatsapp_confirmation_allowed() and gets the correct result'
);

select test.act_as_superuser();

select test.assert(true, 'WhatsApp confirmation subscription gate verified: plan AND ativa status both required, every other status blocked, cross-company isolation holds, missing data fails closed, service_role-only access');
