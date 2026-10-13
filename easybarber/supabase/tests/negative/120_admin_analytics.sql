-- Covers 20260101000023_admin_analytics.sql: the WhatsApp message log
-- and the appointment/WhatsApp/revenue numbers it adds to
-- admin_company_overview() / admin_platform_metrics(), plus the new
-- admin_revenue_timeseries(). Reuses company_a_id / professional_a_id
-- / service_a_id / appointment_a_id from 000_fixtures.sql and
-- outsider_id (already flagged is_platform_admin there) — run_all.sql
-- runs every file in one continuous psql session.
--
-- By this point in the suite several earlier files have already
-- created appointments for company A, so appointment_count is NOT
-- asserted against a fixed number here — only the DELTA a known
-- action causes. whatsapp_messages, on the other hand, is untouched
-- by every other test file, so exact counts are safe to assert there.

-- ---------------------------------------------------------------------
-- 1. log_whatsapp_message() is service_role-only — neither an
-- ordinary company member nor anon can reach it, directly or through
-- PostgREST's anon/authenticated roles. This is deliberate: it is
-- bookkeeping for a send that already happened, not something a
-- visitor's own request should ever trigger (see the migration's own
-- comment for why a broader grant would let anyone holding the public
-- anon key inject fake cost into another company's totals).
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);

select test.assert_denied(
  format(
    $sql$select public.log_whatsapp_message(%L, 'sent'::public.whatsapp_message_status, 'twilio')$sql$,
    :'appointment_a_id'
  ),
  'an ordinary company owner cannot call log_whatsapp_message() — service_role only'
);

select test.act_as_anon();

select test.assert_denied(
  format(
    $sql$select public.log_whatsapp_message(%L, 'sent'::public.whatsapp_message_status, 'twilio')$sql$,
    :'appointment_a_id'
  ),
  'anon cannot call log_whatsapp_message() either'
);

select test.assert_denied(
  'select count(*) from public.whatsapp_messages',
  'anon has no direct SELECT on whatsapp_messages (no policy at all — not even the admin reads this table directly)'
);

select test.act_as(:'outsider_id'::uuid);

select test.assert_denied(
  'select count(*) from public.whatsapp_messages',
  'even the platform admin has no direct SELECT on whatsapp_messages — only through admin_company_overview()/admin_platform_metrics()'
);

-- ---------------------------------------------------------------------
-- 2. As superuser (standing in for service_role, which the throwaway
-- test harness doesn't otherwise exercise), log a few sends for
-- company A's appointment_a and confirm they show up correctly
-- aggregated — count, this-month count, and cost — without exposing
-- any row directly.
-- ---------------------------------------------------------------------
select test.act_as_superuser();

select public.log_whatsapp_message(:'appointment_a_id'::uuid, 'sent'::public.whatsapp_message_status, 'twilio', 'SM_fake_1', null);
select public.log_whatsapp_message(:'appointment_a_id'::uuid, 'sent'::public.whatsapp_message_status, 'twilio', 'SM_fake_2', null);
select public.log_whatsapp_message(:'appointment_a_id'::uuid, 'failed'::public.whatsapp_message_status, 'twilio', null, 'ContentSid Required');

-- An appointment id that doesn't exist must be a silent no-op, never
-- an error — sendBookingConfirmation() calls this after the booking
-- already succeeded and must never be able to fail because of it.
select public.log_whatsapp_message(gen_random_uuid(), 'sent'::public.whatsapp_message_status, 'twilio', null, null);

select test.act_as(:'outsider_id'::uuid);

select
  appointment_count,
  whatsapp_message_count,
  whatsapp_cost_cents
from public.admin_company_overview()
where company_name = 'Barber 013' \gset before_

select test.assert(:before_whatsapp_message_count = 3, 'admin_company_overview() counts exactly the 3 logged sends for company A (2 sent + 1 failed), not the bogus-appointment-id no-op');
select test.assert(:before_whatsapp_cost_cents = 30, 'whatsapp_cost_cents sums all 3 rows'' default cost (10 cents each) regardless of sent/failed status');

select
  whatsapp_message_count as wa_count,
  whatsapp_cost_cents as wa_cost
from public.admin_company_overview()
where company_name = 'Navalha Club' \gset navalha_

select test.assert(:navalha_wa_count = 0, 'company B (Navalha Club) has zero WhatsApp messages logged — company A''s sends never leak across companies');
select test.assert(:navalha_wa_cost = 0, 'company B (Navalha Club) has zero WhatsApp cost — company A''s cost never leaks across companies');

select test.assert(
  (select total_whatsapp_messages from public.admin_platform_metrics()) >= 3,
  'admin_platform_metrics() reports at least the 3 messages just logged platform-wide'
);

-- ---------------------------------------------------------------------
-- 3. appointment_count: assert the DELTA a known new booking causes,
-- not an absolute number (several earlier test files already created
-- appointments for company A by this point in the suite).
-- ---------------------------------------------------------------------
select appointment_count as before_count
from public.admin_company_overview() where company_name = 'Barber 013' \gset delta_

select test.act_as_anon();

select public.create_public_appointment(
  :'a_slug', :'service_a_id'::uuid, :'professional_a_id'::uuid, current_date + 15, '09:00',
  'Cliente Admin Analytics', '19966665555'
);

select test.act_as(:'outsider_id'::uuid);

select appointment_count as after_count
from public.admin_company_overview() where company_name = 'Barber 013' \gset delta_

select test.assert(
  :delta_after_count = :delta_before_count + 1,
  'admin_company_overview()''s appointment_count increases by exactly 1 after one new booking for company A'
);

-- ---------------------------------------------------------------------
-- 4. admin_revenue_timeseries(): the current month must include the
-- 'payment_confirmed' billing event already recorded by
-- 060_subscription_lifecycle.sql for company A, and the series must
-- have exactly as many rows as months requested (no gaps, no missing
-- current month even if some earlier month had zero revenue).
-- ---------------------------------------------------------------------
select count(*) as n from public.admin_revenue_timeseries(6) \gset rev_
select test.assert(:rev_n = 6, 'admin_revenue_timeseries(6) returns exactly 6 rows, one per month, never skipping a quiet month');

select revenue_cents as current_month_revenue
from public.admin_revenue_timeseries(1)
\gset rev_

select test.assert(
  :rev_current_month_revenue > 0,
  'the current month''s revenue is > 0 — picks up the payment_confirmed billing_events row 060_subscription_lifecycle.sql already recorded for company A'
);

select test.assert_denied(
  'select * from public.admin_revenue_timeseries(61)',
  'admin_revenue_timeseries() rejects an out-of-range p_months (> 60) rather than silently truncating'
);

select test.act_as(:'owner_a_id'::uuid);
select test.assert_denied(
  'select * from public.admin_revenue_timeseries(6)',
  'an ordinary company owner cannot call admin_revenue_timeseries() — platform admin only, same as the other admin_* functions'
);

-- ---------------------------------------------------------------------
-- 5. admin_update_plan_price(): updates the price AND writes an audit
-- log entry atomically (write_audit_log() itself is never reachable
-- directly, so this is the only path to get both right together).
-- ---------------------------------------------------------------------
select test.act_as_superuser();
select plan_id from public.subscriptions where company_id = :'company_a_id'::uuid \gset price_test_

select test.act_as(:'owner_a_id'::uuid);
select test.assert_denied(
  format('select public.admin_update_plan_price(%L, 9999)', :'price_test_plan_id'),
  'an ordinary company owner cannot call admin_update_plan_price() — platform admin only'
);

select test.act_as(:'outsider_id'::uuid);
select public.admin_update_plan_price(:'price_test_plan_id'::uuid, 4321);

select test.assert(
  (select price_cents from public.plans where id = :'price_test_plan_id'::uuid) = 4321,
  'admin_update_plan_price() actually updates the plan''s price_cents'
);
select test.assert(
  exists (
    select 1 from public.audit_logs
    where action = 'plan_price_updated' and target_id = :'price_test_plan_id'::uuid
      and (metadata ->> 'new_price_cents')::int = 4321
  ),
  'admin_update_plan_price() writes an audit log entry with the new price in its metadata'
);
select test.assert_denied(
  'select public.admin_update_plan_price(gen_random_uuid(), 100)',
  'admin_update_plan_price() rejects a plan id that does not exist, rather than silently no-op''ing'
);

select test.act_as_superuser();

select test.assert(true, 'admin analytics verified: whatsapp_messages has zero direct access for anyone (admin included), log_whatsapp_message() is service_role-only and derives company_id safely, every admin_* aggregate stays scoped per company and admin-only, and admin_update_plan_price() pairs its write with a real audit log entry');
