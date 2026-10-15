-- Plan-gated WhatsApp confirmations + the extended log_whatsapp_message()
-- (20260101000026_whatsapp_plan_gating_and_subscription_alerts.sql).

select test.act_as_superuser();

-- ---------------------------------------------------------------------
-- 1. Seed data sanity: Essencial does NOT include the automated
-- confirmation, Profissional does. This is exactly what
-- sendBookingConfirmation() (src/lib/actions/public-booking.ts) reads
-- before deciding whether to send — a wrong flag here would silently
-- break the gating with no SQL-level signal.
-- ---------------------------------------------------------------------
select whatsapp_confirmations_included as included
from public.plans where name = 'Essencial' \gset essencial_
select test.assert(
  :'essencial_included'::boolean is false,
  'Essencial plan does not include the automated WhatsApp confirmation'
);

select whatsapp_confirmations_included as included
from public.plans where name = 'Profissional' \gset profissional_
select test.assert(
  :'profissional_included'::boolean is true,
  'Profissional plan includes the automated WhatsApp confirmation'
);

-- ---------------------------------------------------------------------
-- 2. log_whatsapp_message() access control unchanged by the signature
-- change: still denied to anyone but service_role.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select test.assert_denied(
  format(
    $sql$select public.log_whatsapp_message('sent'::public.whatsapp_message_status, 'twilio', p_company_id => %L)$sql$,
    :'company_a_id'
  ),
  'company owner cannot call log_whatsapp_message directly'
);

select test.act_as_anon();
select test.assert_denied(
  format(
    $sql$select public.log_whatsapp_message('sent'::public.whatsapp_message_status, 'twilio', p_company_id => %L)$sql$,
    :'company_a_id'
  ),
  'anon cannot call log_whatsapp_message'
);

-- ---------------------------------------------------------------------
-- 3. Regression: the original p_appointment_id path (sendBookingConfirmation's
-- own call shape) still derives company_id from the appointment and
-- inserts correctly.
-- ---------------------------------------------------------------------
select test.act_as_superuser();
select count(*) as n from public.whatsapp_messages where company_id = :'company_a_id'::uuid \gset before_appt_

select test.act_as_service_role();
select public.log_whatsapp_message(
  p_status => 'sent'::public.whatsapp_message_status,
  p_provider => 'twilio',
  p_appointment_id => :'appointment_a_id'::uuid,
  p_provider_message_id => 'SMxxx'
);

select test.act_as_superuser();
select count(*) as n from public.whatsapp_messages
where company_id = :'company_a_id'::uuid and appointment_id = :'appointment_a_id'::uuid \gset after_appt_
select test.assert(
  :after_appt_n = :before_appt_n + 1,
  'log_whatsapp_message(p_appointment_id) still derives company_id from the appointment and inserts a row'
);

-- ---------------------------------------------------------------------
-- 4. New path: p_company_id directly, no appointment behind the send —
-- the grace-period reminder's shape
-- (notifyCompanyEnteringGracePeriod()).
-- ---------------------------------------------------------------------
select test.act_as_service_role();

select public.log_whatsapp_message(
  p_status => 'sent'::public.whatsapp_message_status,
  p_provider => 'twilio',
  p_company_id => :'company_a_id'::uuid
);

select test.act_as_superuser();
select count(*) as n from public.whatsapp_messages
where company_id = :'company_a_id'::uuid and appointment_id is null \gset grace_
select test.assert(
  :grace_n = 1,
  'log_whatsapp_message(p_company_id) inserts a row with no appointment_id, attributed to the right company'
);

-- ---------------------------------------------------------------------
-- 5. Neither id given: a safe no-op, not an error — mirrors the
-- original function's "unknown appointment" no-op behavior.
-- ---------------------------------------------------------------------
select count(*) as n from public.whatsapp_messages \gset total_before_

select test.act_as_service_role();
select public.log_whatsapp_message(
  p_status => 'sent'::public.whatsapp_message_status,
  p_provider => 'twilio'
);

select test.act_as_superuser();
select count(*) as n from public.whatsapp_messages \gset total_after_
select test.assert(
  :total_after_n = :total_before_n,
  'log_whatsapp_message() with neither p_appointment_id nor p_company_id is a safe no-op'
);

-- ---------------------------------------------------------------------
-- 6. Cross-company isolation: none of the above touched company B.
-- ---------------------------------------------------------------------
select count(*) as n from public.whatsapp_messages where company_id = :'company_b_id'::uuid \gset companyb_
select test.assert_row_count(0, :companyb_n, 'no whatsapp_messages rows attributed to company B');

select test.assert(true, 'WhatsApp plan gating + extended log_whatsapp_message(): seed data, access control, both attribution paths and the no-op case all verified');
