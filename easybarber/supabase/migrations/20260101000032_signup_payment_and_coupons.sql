-- Item 15 (user request): the customer must make their first payment
-- as part of registration, and a discount-coupon system is needed for
-- launch campaigns (first coupon: "BARBA50", 50% off the first month).
--
-- Two independent additions:
--
--   1. coupons / coupon_redemptions + preview_coupon_discount() /
--      redeem_coupon(): a minimal coupon system. A coupon only ever
--      discounts a company's FIRST payment — every renewal after that
--      charges the plan's normal price (see src/lib/billing/asaas.ts
--      for how the discount is actually applied to just the first
--      Asaas charge, not the recurring subscription value).
--
--   2. Realtime on subscriptions: the new /onboarding/pagamento screen
--      shows "aguardando confirmação do pagamento" right after Pix
--      checkout and must flip to the dashboard the instant the webhook
--      confirms it — same mechanism as appointments
--      (20260101000030_appointments_realtime.sql), same reasoning.
--
-- The actual "pay at registration" enforcement a user experiences is
-- the app-level redirect in src/app/(app)/layout.tsx: an owner whose
-- subscription is still 'pendente' can't reach the dashboard, Agenda,
-- Profissionais or anything else under (app) at all — so there is no
-- path through the app's own UI to create an appointment before that
-- first payment lands. check_company_subscription_active() (the
-- 'suspensa' booking-block trigger from
-- 20260101000025_admin_subscription_control.sql) is deliberately left
-- unchanged here: extending it to also block 'pendente' would be
-- blocking a state nothing in the real product flow can reach in the
-- first place, while also breaking the ordinary assumption — already
-- relied on elsewhere, e.g. supabase/tests/negative/000_fixtures.sql
-- building out a brand new company's data right after creating it —
-- that a freshly signed-up company's own data can be set up
-- immediately, before its first payment is confirmed.

-- ---------------------------------------------------------------------
-- 1. Coupons
-- ---------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent int not null check (discount_percent > 0 and discount_percent <= 100),
  max_redemptions int, -- null = unlimited
  expires_at date,     -- null = no expiry
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.coupons is
  'Discount codes applied to a company''s very first subscription payment only (see redeem_coupon()). Not directly readable/writable by any client — preview_coupon_discount()/redeem_coupon() (SECURITY DEFINER) are the only access path, same pattern as billing_events writes going exclusively through apply_billing_event(). New coupons are added by migration, same as plans.';

alter table public.coupons enable row level security;
-- No select/insert/update/delete policies at all: fully locked from
-- authenticated/anon, intentionally — see the comment above.

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  company_id uuid not null references public.companies(id),
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, company_id)
);

comment on table public.coupon_redemptions is
  'One row per (coupon, company) — a company can redeem a given coupon only once. Written exclusively by redeem_coupon().';

-- Table-level grant only controls whether authenticated may attempt a
-- statement at all — RLS (above/below) is what actually decides which
-- rows are visible or writable, same uniform-grant-plus-RLS-narrows
-- pattern as 20260101000014_grants.sql. coupons keeps every row
-- invisible/unwritable regardless of this grant (no policies at all);
-- coupon_redemptions only adds a SELECT policy, so insert/update/
-- delete stay blocked at the row level for authenticated too.
grant select, insert, update, delete on public.coupons, public.coupon_redemptions to authenticated;

alter table public.coupon_redemptions enable row level security;

create policy coupon_redemptions_select on public.coupon_redemptions
  for select to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]));

create or replace function public.preview_coupon_discount(p_code text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select discount_percent
  from public.coupons
  where code = upper(btrim(p_code))
    and active
    and (expires_at is null or expires_at >= current_date)
    and (
      max_redemptions is null
      or (select count(*) from public.coupon_redemptions where coupon_id = coupons.id) < max_redemptions
    );
$$;

comment on function public.preview_coupon_discount is
  'Read-only: returns the discount percent for a valid, active, not-yet-exhausted coupon code, or null if the code is invalid/inactive/expired/exhausted. Records nothing — see redeem_coupon() for the call that actually consumes a redemption. Safe to expose to any authenticated user: it only ever reveals the discount for the ONE exact code passed in, never a listing of other coupons.';

revoke all on function public.preview_coupon_discount(text) from public;
grant execute on function public.preview_coupon_discount(text) to authenticated;

create or replace function public.redeem_coupon(p_company_id uuid, p_code text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon record;
begin
  if not public.has_company_role(p_company_id, array['owner']::public.company_member_role[]) then
    raise exception 'Apenas o proprietário da barbearia pode aplicar um cupom.'
      using errcode = '42501';
  end if;

  select * into v_coupon
  from public.coupons
  where code = upper(btrim(p_code))
  for update;

  if not found or not v_coupon.active
     or (v_coupon.expires_at is not null and v_coupon.expires_at < current_date) then
    raise exception 'Cupom inválido ou expirado.' using errcode = 'P0001';
  end if;

  -- Already redeemed by this exact company (e.g. a retried/abandoned
  -- checkout) — same discount, no new row, no error. This is what
  -- makes the function safe to call again from a retried checkout
  -- without double-counting against max_redemptions.
  if exists (
    select 1 from public.coupon_redemptions
    where coupon_id = v_coupon.id and company_id = p_company_id
  ) then
    return v_coupon.discount_percent;
  end if;

  if v_coupon.max_redemptions is not null then
    if (select count(*) from public.coupon_redemptions where coupon_id = v_coupon.id) >= v_coupon.max_redemptions then
      raise exception 'Este cupom já atingiu o limite de usos.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.coupon_redemptions (coupon_id, company_id)
  values (v_coupon.id, p_company_id);

  return v_coupon.discount_percent;
end;
$$;

comment on function public.redeem_coupon is
  'Validates a coupon code for p_company_id (caller must be that company''s owner) and records the redemption, returning the discount percent to apply to the first payment. Idempotent per (coupon, company): calling it again with the same code after an abandoned checkout returns the same discount rather than erroring or double-counting against max_redemptions.';

revoke all on function public.redeem_coupon(uuid, text) from public;
grant execute on function public.redeem_coupon(uuid, text) to authenticated;

-- Seed the initial campaign coupon (user request: 50% off the first
-- month, code "BARBA50", no cap/expiry for this first campaign).
insert into public.coupons (code, discount_percent)
values ('BARBA50', 50);

-- ---------------------------------------------------------------------
-- 2. Realtime for subscriptions
-- ---------------------------------------------------------------------
alter table public.subscriptions replica identity full;
alter publication supabase_realtime add table public.subscriptions;
