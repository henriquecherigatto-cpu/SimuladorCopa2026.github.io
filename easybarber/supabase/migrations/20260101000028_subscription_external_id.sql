-- Besides external_customer_id (the Asaas CUSTOMER id), we now also
-- need the Asaas SUBSCRIPTION id: it's what GET /v3/payments?subscription=
-- is filtered by to find the subscription's current open invoice (see
-- getOpenInvoice() in src/lib/billing/asaas.ts) — the customer id alone
-- isn't enough to look that up. Populated going forward by
-- createCheckoutSession (src/lib/actions/billing.ts); null for any
-- subscription created before this column existed, same as
-- external_customer_id starts null until the first checkout.

alter table public.subscriptions
  add column external_subscription_id text;

comment on column public.subscriptions.external_subscription_id is
  'The payment provider''s own subscription id (e.g. Asaas''s /subscriptions id) — distinct from external_customer_id. Used to fetch the subscription''s current open invoice on demand.';
