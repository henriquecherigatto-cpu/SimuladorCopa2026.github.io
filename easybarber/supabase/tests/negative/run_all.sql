-- Runs the full negative-test suite as a single psql session (so
-- \gset fixture ids declared in 000_fixtures.sql stay in scope for
-- every file included after it). Invoked by ../run-local-tests.sh.
\set ON_ERROR_STOP on
\set QUIET on
\pset pager off
\set QUIET off

\echo '=== 000_fixtures.sql ==='
\ir 000_fixtures.sql
\echo '=== 010_cross_company_select.sql ==='
\ir 010_cross_company_select.sql
\echo '=== 020_cross_company_write.sql ==='
\ir 020_cross_company_write.sql
\echo '=== 030_privilege_escalation.sql ==='
\ir 030_privilege_escalation.sql
\echo '=== 040_concurrency_conflict.sql ==='
\ir 040_concurrency_conflict.sql
\echo '=== 050_admin_scope.sql ==='
\ir 050_admin_scope.sql
\echo '=== 060_subscription_lifecycle.sql ==='
\ir 060_subscription_lifecycle.sql
\echo '=== 070_public_booking.sql ==='
\ir 070_public_booking.sql
\echo '=== 080_public_appointment_lookup.sql ==='
\ir 080_public_appointment_lookup.sql
\echo '=== 090_professional_breaks.sql ==='
\ir 090_professional_breaks.sql
\echo '=== 100_public_cancellation.sql ==='
\ir 100_public_cancellation.sql
\echo '=== 110_appointment_timezone.sql ==='
\ir 110_appointment_timezone.sql
\echo '=== 120_admin_analytics.sql ==='
\ir 120_admin_analytics.sql
\echo '=== 130_subscription_enforcement.sql ==='
\ir 130_subscription_enforcement.sql
\echo '=== 140_whatsapp_plan_gating.sql ==='
\ir 140_whatsapp_plan_gating.sql
\echo '=== 150_signup_payment_coupons.sql ==='
\ir 150_signup_payment_coupons.sql
\echo '=== 160_admin_plan_change.sql ==='
\ir 160_admin_plan_change.sql

\echo '=== ALL NEGATIVE TESTS PASSED ==='
