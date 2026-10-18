-- Seed an additional coupon (user request): 75% off the first month,
-- code "DEV75", no cap/expiry — same unrestricted shape as BARBA50
-- (20260101000032_signup_payment_and_coupons.sql). New coupons are
-- only ever added by migration (see that file's comment on
-- public.coupons) — there is no admin UI path to create one.
--
-- 75% was chosen over the DEV99/DEV85 the user first asked for
-- because Asaas rejects any Pix charge under R$5,00: on the only
-- plan sellable today (Essencial, R$24,90), 99% and 85% off both
-- round to less than that floor (R$0,25 and R$3,74) and fail at
-- checkout with "valor da cobrança... não pode ser menor que
-- R$5,00". 75% off rounds to R$6,23, safely above it.
insert into public.coupons (code, discount_percent)
values ('DEV75', 75);
