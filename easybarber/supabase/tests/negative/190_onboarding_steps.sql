-- Covers 20260101000038_onboarding_steps.sql: advance_onboarding_step()
-- is owner-only, compare-and-swap (a stale/wrong expected step is a
-- safe no-op, never an error and never a skipped/replayed step), and
-- scoped to the caller's own company regardless of what company id a
-- request sends. Both fixture companies are created through
-- create_company_with_owner() (000_fixtures.sql), so both start this
-- file at onboarding_step = 0 — nothing earlier in the suite touches
-- this column.

select test.act_as_superuser();

-- ---------------------------------------------------------------------
-- 1. Owner A can advance their own company step by step, 0 -> 1 -> 2 -> 3.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);

select public.advance_onboarding_step(:'company_a_id'::uuid, 0::smallint) as advanced \gset step1_
select test.assert(:'step1_advanced'::boolean is true, 'owner A advances company A from step 0 to 1');

select onboarding_step from public.companies where id = :'company_a_id'::uuid \gset check1_
select test.assert(:'check1_onboarding_step'::int = 1, 'onboarding_step actually reads back as 1');

select public.advance_onboarding_step(:'company_a_id'::uuid, 1::smallint) as advanced \gset step2_
select test.assert(:'step2_advanced'::boolean is true, 'owner A advances company A from step 1 to 2');

select public.advance_onboarding_step(:'company_a_id'::uuid, 2::smallint) as advanced \gset step3_
select test.assert(:'step3_advanced'::boolean is true, 'owner A advances company A from step 2 to 3 (fully onboarded)');

select onboarding_step from public.companies where id = :'company_a_id'::uuid \gset check3_
select test.assert(:'check3_onboarding_step'::int = 3, 'company A reads back fully onboarded (step 3)');

-- ---------------------------------------------------------------------
-- 2. Compare-and-swap: a stale/wrong expected step is a safe no-op —
-- returns false, never raises, never changes the stored value.
-- (Required-style guarantee: a double-submit, e.g. two tabs or a
-- double click, can only ever advance once.)
-- ---------------------------------------------------------------------
select public.advance_onboarding_step(:'company_a_id'::uuid, 2::smallint) as advanced \gset stale_
select test.assert(:'stale_advanced'::boolean is false, 'advancing from an already-passed expected step (2, company is already at 3) is a safe no-op');

select onboarding_step from public.companies where id = :'company_a_id'::uuid \gset stillcheck_
select test.assert(:'stillcheck_onboarding_step'::int = 3, 'onboarding_step is unchanged by the stale call above');

-- ---------------------------------------------------------------------
-- 3. Owner-only: a professional of the SAME company cannot advance
-- it, even their own — has_company_role()'s authorization check runs
-- (and denies) before the compare-and-swap is ever attempted, so this
-- is denied regardless of company A's current onboarding_step value.
-- ---------------------------------------------------------------------
select test.act_as(:'prof_a_user_id'::uuid);
select test.assert_denied(
  format('select public.advance_onboarding_step(%L, 0::smallint)', :'company_a_id'),
  'a professional (non-owner) cannot advance their own company''s onboarding step'
);

-- ---------------------------------------------------------------------
-- 4. anon cannot advance anything either.
-- ---------------------------------------------------------------------
select test.act_as_anon();
select test.assert_denied(
  format('select public.advance_onboarding_step(%L, 0::smallint)', :'company_b_id'),
  'anon cannot advance any company''s onboarding step'
);

-- ---------------------------------------------------------------------
-- 5. Cross-company isolation: owner A cannot advance company B's step
-- by passing company B's id — proves altering the company id a
-- request sends never grants access to another barbershop's
-- onboarding progress.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select test.assert_denied(
  format('select public.advance_onboarding_step(%L, 0::smallint)', :'company_b_id'),
  'owner A cannot advance company B''s onboarding step'
);

select test.act_as_superuser();
select onboarding_step from public.companies where id = :'company_b_id'::uuid \gset companyb_
select test.assert(:'companyb_onboarding_step'::int = 0, 'company B''s own onboarding_step is untouched by owner A''s attempt above');

select test.assert(true, 'Onboarding steps: owner-only, compare-and-swap-safe against replay, and cross-company isolation all verified');
