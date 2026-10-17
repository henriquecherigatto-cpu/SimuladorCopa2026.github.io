-- Coupons: preview_coupon_discount()/redeem_coupon()
-- (20260101000032_signup_payment_and_coupons.sql).
--
-- Uses the two companies from 000_fixtures.sql. Resets company A's
-- subscription to a known baseline first, same reasoning as
-- 130_subscription_enforcement.sql: run_all.sql runs every file in one
-- shared session, so this file's assertions must not depend on
-- whatever state earlier files left behind.

select test.act_as_superuser();

update public.subscriptions
set status = 'pendente', current_period_end = null, grace_period_ends_at = null, canceled_at = null
where company_id in (:'company_a_id'::uuid, :'company_b_id'::uuid);

delete from public.coupon_redemptions
where company_id in (:'company_a_id'::uuid, :'company_b_id'::uuid);

-- ---------------------------------------------------------------------
-- 1. Seed data sanity: BARBA50 exists, 50% off, unlimited/no expiry.
-- ---------------------------------------------------------------------
select discount_percent, max_redemptions is null as unlimited, expires_at is null as no_expiry
from public.coupons where code = 'BARBA50' \gset barba50_

select test.assert(:'barba50_discount_percent' = '50', 'BARBA50 seeded with 50% discount');
select test.assert(:'barba50_unlimited'::boolean, 'BARBA50 seeded with no redemption cap');
select test.assert(:'barba50_no_expiry'::boolean, 'BARBA50 seeded with no expiry');

-- ---------------------------------------------------------------------
-- 2. preview_coupon_discount: read-only, case-insensitive, no side
-- effects (no row recorded).
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);

select public.preview_coupon_discount('BARBA50') as discount \gset preview1_
select test.assert(:'preview1_discount' = '50', 'preview_coupon_discount("BARBA50") returns 50');

select public.preview_coupon_discount('barba50') as discount \gset preview2_
select test.assert(:'preview2_discount' = '50', 'preview_coupon_discount is case-insensitive');

-- Not routed through \gset: a NULL result leaves a \gset variable
-- unset rather than set-to-null, so the usual :'var' is null check
-- would substitute nothing and break the SQL syntax. Calling the
-- function inline inside assert() sidesteps that entirely.
select test.assert(
  public.preview_coupon_discount('NAOEXISTE') is null,
  'preview_coupon_discount returns null for an unknown code'
);

select test.act_as_superuser();
select count(*) as n from public.coupon_redemptions where coupon_id = (select id from public.coupons where code = 'BARBA50') \gset afterpreview_
select test.assert_row_count(0, :afterpreview_n, 'preview_coupon_discount never records a redemption');

-- ---------------------------------------------------------------------
-- 3. Access control: only the company's own OWNER can redeem for it.
-- ---------------------------------------------------------------------
select test.act_as(:'prof_a_user_id'::uuid);
select test.assert_denied(
  format($sql$select public.redeem_coupon(%L, 'BARBA50')$sql$, :'company_a_id'),
  'a professional (not owner) of company A cannot redeem a coupon for it'
);

select test.act_as(:'owner_b_id'::uuid);
select test.assert_denied(
  format($sql$select public.redeem_coupon(%L, 'BARBA50')$sql$, :'company_a_id'),
  'company B''s owner cannot redeem a coupon for company A'
);

select test.act_as_anon();
select test.assert_denied(
  format($sql$select public.redeem_coupon(%L, 'BARBA50')$sql$, :'company_a_id'),
  'anon cannot redeem a coupon'
);

-- ---------------------------------------------------------------------
-- 4. redeem_coupon as the rightful owner: returns the discount and
-- records exactly one redemption row.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select public.redeem_coupon(:'company_a_id'::uuid, 'BARBA50') as discount \gset redeem1_
select test.assert(:'redeem1_discount' = '50', 'redeem_coupon("BARBA50") for company A returns 50');

select test.act_as_superuser();
select count(*) as n from public.coupon_redemptions
where coupon_id = (select id from public.coupons where code = 'BARBA50') and company_id = :'company_a_id'::uuid
\gset redemption_
select test.assert_row_count(1, :redemption_n, 'exactly one redemption row recorded for company A + BARBA50');

-- ---------------------------------------------------------------------
-- 5. Idempotent retry: redeeming the SAME coupon again for the SAME
-- company (e.g. a retried/abandoned checkout) returns the same
-- discount and does not create a second row.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select public.redeem_coupon(:'company_a_id'::uuid, 'BARBA50') as discount \gset redeem2_
select test.assert(:'redeem2_discount' = '50', 'redeeming BARBA50 again for company A still returns 50 (idempotent)');

select test.act_as_superuser();
select count(*) as n from public.coupon_redemptions
where coupon_id = (select id from public.coupons where code = 'BARBA50') and company_id = :'company_a_id'::uuid
\gset redemption2_
select test.assert_row_count(1, :redemption2_n, 'retrying redeem_coupon did not create a second redemption row');

-- ---------------------------------------------------------------------
-- 6. Owner can read their own redemption (coupon_redemptions_select);
-- company B's owner cannot see company A's redemption.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select count(*) as n from public.coupon_redemptions where company_id = :'company_a_id'::uuid \gset ownerread_
select test.assert_row_count(1, :ownerread_n, 'company A''s owner can read their own coupon_redemptions row');

select test.act_as(:'owner_b_id'::uuid);
select count(*) as n from public.coupon_redemptions where company_id = :'company_a_id'::uuid \gset crossread_
select test.assert_row_count(0, :crossread_n, 'company B''s owner cannot read company A''s coupon_redemptions row');

-- ---------------------------------------------------------------------
-- 7. Invalid / inactive / expired / exhausted coupons.
-- ---------------------------------------------------------------------
select test.act_as_superuser();

insert into public.coupons (code, discount_percent, active) values ('INATIVO10', 10, false);
insert into public.coupons (code, discount_percent, expires_at) values ('VENCIDO20', 20, current_date - 1);
insert into public.coupons (code, discount_percent, max_redemptions) values ('LIMITADO30', 30, 1)
  returning id as limitado_id \gset

select test.act_as(:'owner_a_id'::uuid);

select test.assert(
  public.preview_coupon_discount('INATIVO10') is null,
  'preview_coupon_discount returns null for an inactive coupon'
);
select test.assert_denied(
  format($sql$select public.redeem_coupon(%L, 'INATIVO10')$sql$, :'company_a_id'),
  'redeem_coupon rejects an inactive coupon'
);

select test.assert(
  public.preview_coupon_discount('VENCIDO20') is null,
  'preview_coupon_discount returns null for an expired coupon'
);
select test.assert_denied(
  format($sql$select public.redeem_coupon(%L, 'VENCIDO20')$sql$, :'company_a_id'),
  'redeem_coupon rejects an expired coupon'
);

select test.assert_denied(
  format($sql$select public.redeem_coupon(%L, 'NAOEXISTE')$sql$, :'company_a_id'),
  'redeem_coupon rejects an unknown code'
);

-- LIMITADO30 has max_redemptions = 1: company A redeems it first (the
-- only slot), then company B must be rejected as exhausted — but
-- company A retrying afterwards must still succeed (idempotent, same
-- company that already holds the one slot).
select public.redeem_coupon(:'company_a_id'::uuid, 'LIMITADO30') as discount \gset limitado1_
select test.assert(:'limitado1_discount' = '30', 'company A redeems the only slot of LIMITADO30');

select test.act_as(:'owner_b_id'::uuid);
select test.assert_denied(
  format($sql$select public.redeem_coupon(%L, 'LIMITADO30')$sql$, :'company_b_id'),
  'company B is rejected: LIMITADO30 already exhausted its single redemption slot'
);

select test.act_as(:'owner_a_id'::uuid);
select public.redeem_coupon(:'company_a_id'::uuid, 'LIMITADO30') as discount \gset limitado2_
select test.assert(:'limitado2_discount' = '30', 'company A (already holding the slot) can still redeem LIMITADO30 again');

-- ---------------------------------------------------------------------
-- 8. Cross-company isolation: none of the above touched company B's
-- subscription or booking ability beyond the exhaustion check in 7.
-- (check_company_subscription_active() is intentionally unchanged by
-- this migration — still 'suspensa'-only; a 'pendente' company's own
-- app-level redirect, not a data-layer trigger, is what actually
-- keeps it from reaching Agenda/Profissionais/etc. in the first
-- place. See src/app/(app)/layout.tsx and the migration's own header
-- comment.)
-- ---------------------------------------------------------------------
select test.act_as_superuser();
select count(*) as n from public.coupon_redemptions where company_id = :'company_b_id'::uuid \gset companyb_redemptions_
select test.assert_row_count(0, :companyb_redemptions_n, 'company B redeemed nothing successfully in this file');

select test.assert(true, 'Coupons (preview/redeem, idempotency, access control, exhaustion, cross-company isolation): all verified');
