-- Subscription state machine: vencimento, tolerância (10 dias),
-- suspensão and reativação (20260101000017_subscription_lifecycle.sql).
--
-- Every event fed into apply_billing_event() here is SIMULATED and
-- marked as such: provider is always 'simulado' (never 'asaas' or any
-- real provider name) and every provider_event_id is prefixed
-- 'sim-', so these rows can never be confused with real payment-
-- provider traffic if this ever ran against a real project (it
-- doesn't — this is the local-only throwaway harness, see
-- run-local-tests.sh). Real webhook payloads are only ever accepted
-- by src/app/api/billing/webhook/route.ts after verifying the
-- provider's signature/token — nothing here substitutes for that.
--
-- Uses the two companies from 000_fixtures.sql: company_a_id (owner
-- owner_a_id) is the one this file drives through the full lifecycle;
-- company_b_id is the control group, asserted untouched throughout to
-- prove one company's billing events can never leak into another's
-- subscription.

select test.act_as_superuser();

-- ---------------------------------------------------------------------
-- Access control: neither function is reachable from a normal client,
-- however it's invoked. This is the concrete guarantee behind "não
-- confiar no navegador para confirmar pagamentos" — checked FIRST,
-- before any state exists for company A, so there's no way a bug here
-- could be masked by state a later step already set up correctly.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);

select test.assert_denied(
  format(
    $sql$select public.apply_billing_event('simulado', 'sim-forged-1', %L, 'payment_confirmed', 2490, 'CONFIRMED', '{}'::jsonb)$sql$,
    :'company_a_id'
  ),
  'owner cannot call apply_billing_event directly (self-activation must be impossible)'
);

select test.assert_denied(
  'select public.sweep_subscription_lifecycle()',
  'owner cannot call sweep_subscription_lifecycle directly'
);

-- (020_cross_company_write.sql already covers "owner cannot UPDATE
-- their own subscriptions row to ativa directly" via
-- test.exec_affected_rows — RLS makes a blocked UPDATE affect 0 rows
-- rather than raise, so it isn't a test.assert_denied-shaped check.)

select test.act_as_anon();

select test.assert_denied(
  format(
    $sql$select public.apply_billing_event('simulado', 'sim-forged-2', %L, 'payment_confirmed', 2490, 'CONFIRMED', '{}'::jsonb)$sql$,
    :'company_a_id'
  ),
  'anon cannot call apply_billing_event'
);

select test.assert_denied(
  'select public.sweep_subscription_lifecycle()',
  'anon cannot call sweep_subscription_lifecycle'
);

-- ---------------------------------------------------------------------
-- Baseline: run_all.sql runs every file in one shared session, and
-- 050_admin_scope.sql (run just before this file) deliberately left
-- company A's subscription 'ativa' as part of proving an admin CAN
-- make that direct write. Reset to the same fresh state
-- create_company_with_owner() produces at signup ('pendente', no
-- period end yet) so this file's own assertions are independent of
-- whatever earlier files did.
-- ---------------------------------------------------------------------
select test.act_as_superuser();

update public.subscriptions
set status = 'pendente', current_period_end = null, grace_period_ends_at = null, canceled_at = null
where company_id = :'company_a_id'::uuid;

select status = 'pendente' as ok from public.subscriptions where company_id = :'company_a_id'::uuid \gset
select test.assert(:'ok'::boolean, 'baseline: company A subscription reset to pendente');

-- The reset UPDATE above (and whatever 050_admin_scope.sql did before
-- it) already triggered subscriptions_audit_status_change a couple of
-- times. Clear those out so section 11 below can assert an exact,
-- self-contained count of the transitions THIS file performs.
delete from public.audit_logs
where company_id = :'company_a_id'::uuid and action = 'subscription_status_changed';

-- ---------------------------------------------------------------------
-- 1. First payment confirmed: pendente -> ativa. This is what the
-- webhook handler does after verifying a real provider's signature;
-- here it's called directly as service_role, exactly the privilege
-- level the route handler runs with.
-- ---------------------------------------------------------------------
select test.act_as_service_role();

select public.apply_billing_event(
  'simulado', 'sim-evt-1', :'company_a_id'::uuid, 'payment_confirmed', 2490, 'CONFIRMED',
  '{"note": "simulated first payment"}'::jsonb, (current_date + 30)
) as result_1 \gset

select test.act_as_superuser();

select status, current_period_end, (grace_period_ends_at is null) as grace_is_null
from public.subscriptions where company_id = :'company_a_id'::uuid \gset sub1_

select test.assert(:'sub1_status' = 'ativa', 'first payment_confirmed moves pendente -> ativa');
select test.assert(:'sub1_current_period_end' = (current_date + 30)::text, 'current_period_end set from the event''s next-due date');
select test.assert(:'sub1_grace_is_null'::boolean, 'grace_period_ends_at is null while ativa');

-- ---------------------------------------------------------------------
-- 2. Idempotency: replaying the SAME provider_event_id must be a
-- total no-op, even though the payload below claims a different
-- (bogus) status — proving the dedupe happens before any state logic
-- runs, not just that the resulting status happens to match.
-- ---------------------------------------------------------------------
select test.act_as_service_role();

select public.apply_billing_event(
  'simulado', 'sim-evt-1', :'company_a_id'::uuid, 'subscription_canceled', 2490, 'CONFIRMED', '{}'::jsonb
) as result_1_replay \gset

select test.act_as_superuser();

select count(*) as n from public.billing_events
where provider = 'simulado' and provider_event_id = 'sim-evt-1' \gset dupe_

select test.assert_row_count(1, :dupe_n, 'replayed provider_event_id produces exactly one billing_events row');

select status from public.subscriptions where company_id = :'company_a_id'::uuid \gset sub2_
select test.assert(:'sub2_status' = 'ativa', 'replayed event did not re-apply (subscription still ativa, not cancelada)');

-- ---------------------------------------------------------------------
-- 3. Vencimento: simulate the due date passing with no renewal, by
-- backdating current_period_end the way a real clock eventually would
-- on its own — then run the sweep, exactly as a daily scheduled job
-- would. ativa -> tolerancia, with a 10-day grace window from the due
-- date (not from "today the sweep happened to run").
-- ---------------------------------------------------------------------
update public.subscriptions
set current_period_end = current_date - 1
where company_id = :'company_a_id'::uuid;

select test.act_as_service_role();
select * from public.sweep_subscription_lifecycle();
select test.act_as_superuser();

select status, grace_period_ends_at from public.subscriptions
where company_id = :'company_a_id'::uuid \gset sub3_

select test.assert(:'sub3_status' = 'tolerancia', 'sweep moves ativa -> tolerancia once current_period_end has passed');
select test.assert(
  :'sub3_grace_period_ends_at' = (current_date - 1 + 10)::text,
  'grace_period_ends_at = due date + 10-day grace period (not sweep run date + 10)'
);

-- Re-running the sweep immediately must be a no-op for a subscription
-- already in tolerancia whose grace period hasn't elapsed yet.
select test.act_as_service_role();
select * from public.sweep_subscription_lifecycle();
select test.act_as_superuser();
select status from public.subscriptions where company_id = :'company_a_id'::uuid \gset sub3b_
select test.assert(:'sub3b_status' = 'tolerancia', 'sweep is idempotent: still tolerancia, not prematurely suspended');

-- ---------------------------------------------------------------------
-- 4. Reativação dentro do período de tolerância: a payment confirmed
-- while in tolerancia goes straight back to ativa (never passes
-- through suspensa) — this is the common case of someone paying a
-- couple of days late.
-- ---------------------------------------------------------------------
select test.act_as_service_role();
select public.apply_billing_event(
  'simulado', 'sim-evt-2', :'company_a_id'::uuid, 'payment_confirmed', 2490, 'CONFIRMED',
  '{"note": "simulated late payment, still within grace period"}'::jsonb, (current_date + 30)
);
select test.act_as_superuser();

select status, (grace_period_ends_at is null) as grace_is_null from public.subscriptions
where company_id = :'company_a_id'::uuid \gset sub4_

select test.assert(:'sub4_status' = 'ativa', 'payment_confirmed during tolerancia reactivates straight to ativa');
select test.assert(:'sub4_grace_is_null'::boolean, 'grace_period_ends_at cleared on reactivation');

-- ---------------------------------------------------------------------
-- 5. payment_overdue event path (distinct from the date-sweep): some
-- providers announce "this charge is now overdue" directly. Must
-- behave the same as the sweep noticing it (ativa -> tolerancia).
-- ---------------------------------------------------------------------
select test.act_as_service_role();
select public.apply_billing_event(
  'simulado', 'sim-evt-3', :'company_a_id'::uuid, 'payment_overdue', 2490, 'OVERDUE', '{}'::jsonb
);
select test.act_as_superuser();

select status, current_period_end, grace_period_ends_at
from public.subscriptions where company_id = :'company_a_id'::uuid \gset sub5_

select test.assert(:'sub5_status' = 'tolerancia', 'explicit payment_overdue event moves ativa -> tolerancia');
select test.assert(
  :'sub5_grace_period_ends_at' = (:'sub5_current_period_end'::date + 10)::text,
  'grace window computed from current_period_end + grace_period_days'
);

-- A second overdue notification must not push the grace deadline
-- further out — the clock started on the first one.
select test.act_as_service_role();
select public.apply_billing_event(
  'simulado', 'sim-evt-3b', :'company_a_id'::uuid, 'payment_overdue', 2490, 'OVERDUE', '{}'::jsonb
);
select test.act_as_superuser();
select grace_period_ends_at from public.subscriptions where company_id = :'company_a_id'::uuid \gset sub5b_
select test.assert(
  :'sub5b_grace_period_ends_at' = :'sub5_grace_period_ends_at',
  'duplicate overdue notification does not reset an already-running grace period'
);

-- ---------------------------------------------------------------------
-- 6. Suspensão: grace period fully elapses with no payment.
-- ---------------------------------------------------------------------
update public.subscriptions
set grace_period_ends_at = current_date - 1
where company_id = :'company_a_id'::uuid;

select test.act_as_service_role();
select * from public.sweep_subscription_lifecycle();
select test.act_as_superuser();

select status from public.subscriptions where company_id = :'company_a_id'::uuid \gset sub6_
select test.assert(:'sub6_status' = 'suspensa', 'sweep moves tolerancia -> suspensa once grace_period_ends_at has passed');

-- ---------------------------------------------------------------------
-- 7. Reativação após suspensão: a confirmed payment reaches all the
-- way back to ativa even from suspensa, in one step — the owner
-- shouldn't need any extra action beyond paying.
-- ---------------------------------------------------------------------
select test.act_as_service_role();
select public.apply_billing_event(
  'simulado', 'sim-evt-4', :'company_a_id'::uuid, 'payment_confirmed', 2490, 'CONFIRMED',
  '{"note": "simulated payment after suspension"}'::jsonb, (current_date + 30)
);
select test.act_as_superuser();

select status, (grace_period_ends_at is null) as grace_is_null from public.subscriptions
where company_id = :'company_a_id'::uuid \gset sub7_

select test.assert(:'sub7_status' = 'ativa', 'payment_confirmed reactivates straight from suspensa to ativa');
select test.assert(:'sub7_grace_is_null'::boolean, 'grace_period_ends_at cleared after reactivation from suspensa');

-- ---------------------------------------------------------------------
-- 8. Unknown event type: logged, no state change, no error.
-- ---------------------------------------------------------------------
select test.act_as_service_role();
select public.apply_billing_event(
  'simulado', 'sim-evt-5', :'company_a_id'::uuid, 'invoice_created', 2490, 'PENDING', '{}'::jsonb
);
select test.act_as_superuser();

select status from public.subscriptions where company_id = :'company_a_id'::uuid \gset sub8_
select test.assert(:'sub8_status' = 'ativa', 'unrecognized event_type does not change subscription status');

select count(*) as n from public.billing_events where provider = 'simulado' and provider_event_id = 'sim-evt-5' \gset unk_
select test.assert_row_count(1, :unk_n, 'unrecognized event_type is still recorded in billing_events');

-- ---------------------------------------------------------------------
-- 9. Cancelamento: terminal state, and NOT reversible by a stray
-- payment_confirmed arriving afterwards (e.g. a refund-then-retry
-- race, or a delayed duplicate from before the cancellation).
-- ---------------------------------------------------------------------
select test.act_as_service_role();
select public.apply_billing_event(
  'simulado', 'sim-evt-6', :'company_a_id'::uuid, 'subscription_canceled', 0, 'CANCELED', '{}'::jsonb
);
select test.act_as_superuser();

select status, canceled_at is not null as has_canceled_at
from public.subscriptions where company_id = :'company_a_id'::uuid \gset sub9_

select test.assert(:'sub9_status' = 'cancelada', 'subscription_canceled event moves to cancelada');
select test.assert(:'sub9_has_canceled_at'::boolean, 'canceled_at timestamp recorded on cancellation');

select test.act_as_service_role();
select public.apply_billing_event(
  'simulado', 'sim-evt-7', :'company_a_id'::uuid, 'payment_confirmed', 2490, 'CONFIRMED', '{}'::jsonb
);
select test.act_as_superuser();
select status from public.subscriptions where company_id = :'company_a_id'::uuid \gset sub9b_
select test.assert(:'sub9b_status' = 'cancelada', 'a payment_confirmed event cannot resurrect a cancelled subscription');

-- A sweep after cancellation must also leave it alone (cancelada is
-- not 'ativa' or 'tolerancia', so neither phase should touch it).
select test.act_as_service_role();
select * from public.sweep_subscription_lifecycle();
select test.act_as_superuser();
select status from public.subscriptions where company_id = :'company_a_id'::uuid \gset sub9c_
select test.assert(:'sub9c_status' = 'cancelada', 'sweep never resurrects a cancelled subscription');

-- ---------------------------------------------------------------------
-- 10. Cross-company isolation: none of the above ever touched company
-- B, which never received any billing event and was never swept
-- (its own current_period_end/grace_period_ends_at stayed null
-- throughout, so the sweep's WHERE clauses never match it either).
-- 'ativa' is company B's own fixture baseline (000_fixtures.sql sets
-- both companies 'ativa' right after creation, standing in for an
-- already-operating barbershop) — the point here is that it's
-- unchanged, not that it's any particular value.
-- ---------------------------------------------------------------------
select status from public.subscriptions where company_id = :'company_b_id'::uuid \gset subb_
select test.assert(:'subb_status' = 'ativa', 'company B subscription untouched by any of company A''s simulated events');

select count(*) as n from public.billing_events where company_id = :'company_b_id'::uuid \gset bevb_
select test.assert_row_count(0, :bevb_n, 'no billing_events rows were ever written for company B');

-- ---------------------------------------------------------------------
-- 11. Audit trail: every status transition above left a traceable
-- record, scoped to the right company.
-- ---------------------------------------------------------------------
select count(*) as n from public.audit_logs
where company_id = :'company_a_id'::uuid and action = 'subscription_status_changed' \gset auda_

-- The 7 real transitions above, in order: pendente->ativa (1),
-- ativa->tolerancia via sweep (2), tolerancia->ativa reactivation (3),
-- ativa->tolerancia via explicit overdue event (4),
-- tolerancia->suspensa via sweep (5), suspensa->ativa reactivation
-- (6), ativa->cancelada (7). Every duplicate/no-op step in between
-- (the replayed event, the idempotent re-sweep, the second overdue
-- notification, the unknown event type, and the post-cancellation
-- payment/sweep) left status unchanged, so the trigger never fired
-- for them.
select test.assert(:auda_n = 7, format('expected 7 audit_logs rows for company A''s subscription transitions, got %s', :auda_n));

-- Company B gets exactly 1, not 0: 000_fixtures.sql's single UPDATE
-- flips BOTH companies pendente->ativa (so the "pendente->ativa (1)"
-- transition counted for company A above fires company B's same
-- row-level audit trigger too) — company B just never receives any
-- further event after that, unlike company A's other 6.
select count(*) as n from public.audit_logs
where company_id = :'company_b_id'::uuid and action = 'subscription_status_changed' \gset audb_
select test.assert_row_count(1, :audb_n, 'exactly 1 subscription_status_changed audit entry for company B (the fixtures-level pendente->ativa flip, nothing more)');

select test.assert(true, 'subscription lifecycle state machine: all transitions, idempotency, access control and isolation verified');
