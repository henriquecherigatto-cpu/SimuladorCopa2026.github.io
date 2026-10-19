-- Admin manual subscription control + booking enforcement for a
-- suspended subscription (20260101000025_admin_subscription_control.sql).
--
-- Uses the two companies from 000_fixtures.sql. Resets company A's
-- subscription to a known baseline first, same reasoning as
-- 060_subscription_lifecycle.sql: run_all.sql runs every file in one
-- shared session, so this file's assertions must not depend on
-- whatever state earlier files (060, 120) left behind.

select test.act_as_superuser();

update public.subscriptions
set status = 'pendente', current_period_end = null, grace_period_ends_at = null, canceled_at = null
where company_id = :'company_a_id'::uuid;

delete from public.audit_logs
where company_id = :'company_a_id'::uuid
  and action in ('subscription_status_changed', 'admin_granted_subscription_access');

-- ---------------------------------------------------------------------
-- 0. A 'pendente' subscription (never activated — see
-- 20260101000041_pendente_blocks_bookings.sql) blocks a brand new
-- appointment exactly like 'suspensa' does below — both paths. Company
-- A is freshly reset to 'pendente' above, before section 1 moves it
-- on to 'suspensa'.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);

select test.assert_denied(
  format(
    $sql$insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by)
         values (%L, %L, %L, %L,
           ((current_date + 2 + interval '11 hour') at time zone 'America/Sao_Paulo'),
           ((current_date + 2 + interval '11 hour 45 minute') at time zone 'America/Sao_Paulo'),
           %L)$sql$,
    :'company_a_id', :'customer_a_id', :'professional_a_id', :'service_a_id', :'owner_a_id'
  ),
  'pendente subscription blocks a new appointment insert (owner path)'
);

select slug from public.companies where id = :'company_a_id'::uuid \gset pendentecompanya_

select test.act_as_anon();

select test.assert_denied(
  format(
    $sql$select public.create_public_appointment(%L, %L, %L, (current_date + 2), '11:15'::time, 'Cliente Teste', '19999990099')$sql$,
    :'pendentecompanya_slug', :'service_a_id', :'professional_a_id'
  ),
  'pendente subscription blocks a new appointment via the public booking function'
);

-- ---------------------------------------------------------------------
-- 1. A suspended subscription blocks a brand new appointment — both
-- the owner/professional path (a direct insert, same shape
-- createAppointment() performs) and the public booking path
-- (create_public_appointment(), called as anon).
-- ---------------------------------------------------------------------
select test.act_as_superuser();
update public.subscriptions set status = 'suspensa' where company_id = :'company_a_id'::uuid;

select test.act_as(:'owner_a_id'::uuid);

select test.assert_denied(
  format(
    $sql$insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by)
         values (%L, %L, %L, %L,
           ((current_date + 2 + interval '11 hour') at time zone 'America/Sao_Paulo'),
           ((current_date + 2 + interval '11 hour 45 minute') at time zone 'America/Sao_Paulo'),
           %L)$sql$,
    :'company_a_id', :'customer_a_id', :'professional_a_id', :'service_a_id', :'owner_a_id'
  ),
  'suspended subscription blocks a new appointment insert (owner path)'
);

select slug from public.companies where id = :'company_a_id'::uuid \gset companya_

select test.act_as_anon();

select test.assert_denied(
  format(
    $sql$select public.create_public_appointment(%L, %L, %L, (current_date + 2), '11:15'::time, 'Cliente Teste', '19999990099')$sql$,
    :'companya_slug', :'service_a_id', :'professional_a_id'
  ),
  'suspended subscription blocks a new appointment via the public booking function'
);

-- ---------------------------------------------------------------------
-- 2. The same suspension does NOT block managing an appointment that
-- already exists — the brief is "no new bookings", not "frozen
-- agenda". Updating appointment_a_id's status must still succeed.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);

select test.exec_affected_rows(
  format(
    $sql$update public.appointments set status = 'concluido' where id = %L$sql$,
    :'appointment_a_id'
  )
) as existing_appt_update_n \gset

select test.assert_row_count(1, :existing_appt_update_n, 'an existing appointment can still be updated while the subscription is suspensa');

-- ---------------------------------------------------------------------
-- 3. tolerancia (the grace-period warning state) must NOT block new
-- bookings — only an actual suspensa does. This is the state a
-- company sits in between the due date passing and the 10-day grace
-- period running out.
-- ---------------------------------------------------------------------
select test.act_as_superuser();
update public.subscriptions
set status = 'tolerancia', grace_period_ends_at = current_date + 5
where company_id = :'company_a_id'::uuid;

select test.act_as(:'owner_a_id'::uuid);

insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by)
values (
  :'company_a_id'::uuid, :'customer_a_id'::uuid, :'professional_a_id'::uuid, :'service_a_id'::uuid,
  ((current_date + 3 + interval '11 hour') at time zone 'America/Sao_Paulo'),
  ((current_date + 3 + interval '11 hour 45 minute') at time zone 'America/Sao_Paulo'),
  :'owner_a_id'::uuid
)
returning id as tolerancia_appt_id \gset

select test.assert(:'tolerancia_appt_id' is not null, 'a subscription in tolerancia (grace period) can still take new bookings');

-- ---------------------------------------------------------------------
-- 4. admin_grant_subscription_access: access control first — neither
-- the company's own owner nor an anonymous caller can call it.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select test.assert_denied(
  format($sql$select public.admin_grant_subscription_access(%L, 7)$sql$, :'company_a_id'),
  'company owner cannot call admin_grant_subscription_access on their own company'
);

select test.act_as_anon();
select test.assert_denied(
  format($sql$select public.admin_grant_subscription_access(%L, 7)$sql$, :'company_a_id'),
  'anon cannot call admin_grant_subscription_access'
);

-- ---------------------------------------------------------------------
-- 5. admin_grant_subscription_access, called as the platform admin:
-- extends from today (since current_period_end is null / in the
-- past), sets ativa, clears the grace timer, and logs an explicit
-- audit entry — this subscription is currently 'tolerancia' from
-- step 3 above, a status CHANGE, so the generic
-- subscriptions_audit_status_change trigger also fires here; step 6
-- below covers the no-status-change case the trigger would miss.
-- ---------------------------------------------------------------------
select test.act_as(:'outsider_id'::uuid);

select public.admin_grant_subscription_access(:'company_a_id'::uuid, 7) as granted_until \gset

select test.assert(:'granted_until' = (current_date + 7)::text, 'admin_grant_subscription_access(7) sets current_period_end to today + 7 when there was no future period end');

select test.act_as_superuser();
select status, current_period_end, (grace_period_ends_at is null) as grace_is_null
from public.subscriptions where company_id = :'company_a_id'::uuid \gset grant1_

select test.assert(:'grant1_status' = 'ativa', 'admin_grant_subscription_access reactivates (tolerancia -> ativa)');
select test.assert(:'grant1_current_period_end' = (current_date + 7)::text, 'current_period_end matches the granted date');
select test.assert(:'grant1_grace_is_null'::boolean, 'grace_period_ends_at cleared by admin_grant_subscription_access');

-- ---------------------------------------------------------------------
-- 6. Granting MORE days to an already-ativa subscription must extend
-- from the existing (future) current_period_end, not reset it back to
-- today + days — and must still log an audit entry even though status
-- doesn't change this time (ativa -> ativa), which the generic
-- status-change trigger alone would not catch.
-- ---------------------------------------------------------------------
select test.act_as(:'outsider_id'::uuid);
select public.admin_grant_subscription_access(:'company_a_id'::uuid, 5) as granted_until_2 \gset

select test.assert(
  :'granted_until_2' = (current_date + 7 + 5)::text,
  'granting more days to an already-ativa subscription extends from its existing current_period_end, not from today'
);

select test.act_as_superuser();
select count(*) as n from public.audit_logs
where company_id = :'company_a_id'::uuid and action = 'admin_granted_subscription_access' \gset grantaud_
select test.assert_row_count(2, :grantaud_n, 'both admin_grant_subscription_access calls left an explicit audit entry, including the ativa -> ativa one with no status change');

-- ---------------------------------------------------------------------
-- 7. Rejects an out-of-range day count.
-- ---------------------------------------------------------------------
select test.act_as(:'outsider_id'::uuid);
select test.assert_denied(
  format($sql$select public.admin_grant_subscription_access(%L, 0)$sql$, :'company_a_id'),
  'admin_grant_subscription_access rejects 0 days'
);
select test.assert_denied(
  format($sql$select public.admin_grant_subscription_access(%L, 400)$sql$, :'company_a_id'),
  'admin_grant_subscription_access rejects more than 365 days'
);

-- ---------------------------------------------------------------------
-- 8. Cross-company isolation: none of the above touched company B.
-- 'ativa' is company B's fixture baseline (000_fixtures.sql) — the
-- point is that it's unchanged, not the particular value.
-- ---------------------------------------------------------------------
select test.act_as_superuser();
select status, current_period_end is null as period_end_is_null
from public.subscriptions where company_id = :'company_b_id'::uuid \gset subb_
select test.assert(:'subb_status' = 'ativa', 'company B subscription status untouched');
select test.assert(:'subb_period_end_is_null'::boolean, 'company B current_period_end untouched');

select test.assert(true, 'subscription enforcement and admin manual control: insert-blocking, tolerancia pass-through, existing-appointment updates, access control and grant math all verified');
