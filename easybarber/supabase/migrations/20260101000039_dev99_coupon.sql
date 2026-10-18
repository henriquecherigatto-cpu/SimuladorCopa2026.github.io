-- Seed an additional coupon (user request): 99% off the first month,
-- code "DEV99", no cap/expiry — same unrestricted shape as BARBA50
-- (20260101000032_signup_payment_and_coupons.sql). New coupons are
-- only ever added by migration (see that file's comment on
-- public.coupons) — there is no admin UI path to create one.
insert into public.coupons (code, discount_percent)
values ('DEV99', 99);
