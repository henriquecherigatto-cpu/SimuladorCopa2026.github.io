# Billing integration (Asaas)

How subscriptions move through `pendente → ativa → tolerancia → suspensa → cancelada`,
and what it takes to point this at a real Asaas account.

## Where each piece lives

| Concern | File |
| --- | --- |
| State machine (the only code that ever writes `subscriptions.status`) | `supabase/migrations/20260101000017_subscription_lifecycle.sql` |
| State machine tests (simulated events, no real provider involved) | `supabase/tests/negative/060_subscription_lifecycle.sql` |
| Provider-agnostic types | `src/lib/billing/types.ts` |
| Asaas adapter (HTTP calls, webhook parsing/verification) | `src/lib/billing/asaas.ts` |
| Webhook endpoint | `src/app/api/billing/webhook/route.ts` |
| Due-date/grace-period sweep endpoint | `src/app/api/billing/sweep/route.ts` |
| Checkout-session Server Action (owner-only) | `src/lib/actions/billing.ts` |
| service_role Supabase client (server-only) | `src/lib/supabase/service-role.ts` |

## The security property this is built around

**The browser can never mark a subscription as paid.** Concretely:

- `apply_billing_event()` and `sweep_subscription_lifecycle()` (the only two
  functions that can change `subscriptions.status`) are `REVOKE`d from
  `authenticated`/`anon` and `GRANT`ed only to `service_role` — see the bottom
  of the migration. An owner's own signed-in session cannot call them, full
  stop, regardless of anything the application code does.
- `service_role` is only ever used from two places, both server-only and
  neither reachable by user input alone: the webhook route (after verifying
  the request came from Asaas) and the sweep route (after verifying a shared
  cron secret).
- The checkout Server Action (`createCheckoutSession`) only ever *starts* a
  checkout and returns a redirect URL. It does not call `apply_billing_event`
  and cannot change `subscriptions.status`. The page the browser lands on
  after checkout (`/plano?checkout=pendente`) is informational only — the
  real status the UI shows always comes from the `subscriptions` row, which
  only the webhook can update.
- No payment credential ever reaches this application's server.
  `createCheckoutSession` creates an Asaas customer + subscription via their
  API and hands back the `invoiceUrl` of the generated invoice — a page
  hosted on `asaas.com` showing the Pix QR code/copy-paste key. Every
  subscription is created with `billingType: "PIX"` — the platform owner's
  own choice to offer only Pix for now (Asaas itself also supports boleto
  and card; this is this app's own restriction, in `src/lib/billing/asaas.ts`).

## Going live

1. **Create an Asaas account** (sandbox first: <https://sandbox.asaas.com>,
   then production at <https://www.asaas.com>).
2. **API key**: Account → Integrations → API key. Set `ASAAS_API_KEY`.
   `ASAAS_API_BASE_URL` is `https://api-sandbox.asaas.com/v3` for sandbox,
   `https://api.asaas.com/v3` for production.
3. **Webhook**: register `https://<your-domain>/api/billing/webhook` in
   Asaas's webhook settings, subscribed to at least `PAYMENT_CONFIRMED`,
   `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`. Asaas lets
   you set a custom auth token for the webhook — generate one
   (`openssl rand -hex 32`) and set it both in Asaas's dashboard and as
   `ASAAS_WEBHOOK_TOKEN` here. This is what `verifyWebhookRequest()` checks on
   every delivery.
4. **Sweep schedule**: `vercel.json` already declares a daily Vercel Cron Job
   hitting `/api/billing/sweep` at 06:00 UTC — if you deploy to Vercel, set
   `CRON_SECRET` as an environment variable and you're done: Vercel
   automatically sends it as `Authorization: Bearer <value>` on every
   cron-triggered request (that's the one env var name it treats specially).
   Not deploying to Vercel? Point any scheduler at that same path instead —
   it answers both GET and POST, as long as the same header is sent (a 10-day
   grace period doesn't need finer granularity, but more frequent is
   harmless — every run only touches rows whose own date columns say they're
   actually due):
   - A scheduled GitHub Actions workflow doing
     `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/billing/sweep`.
   - A Supabase scheduled Edge Function, or `pg_cron` calling
     `select public.sweep_subscription_lifecycle();` directly inside
     Postgres, if your project has the `pg_cron` extension enabled — the
     function itself doesn't care which trigger calls it.
5. **CPF/CNPJ**: `createCheckoutSession` requires `companies.cnpj` to be set
   (Asaas needs a CPF/CNPJ to issue an invoice — the column is named `cnpj`
   but holds either) — the Server Action returns a clear error pointing the
   owner at Configurações if it's missing. Editable from Configurações →
   Dados da barbearia → "CPF ou CNPJ".

## Verifying it without a real Asaas account

The state machine itself needs no provider at all — see
`bash supabase/tests/run-local-tests.sh`, which runs
`060_subscription_lifecycle.sql` against simulated events (`provider =
'simulado'`, event ids prefixed `sim-`) covering every transition,
idempotency, and the access-control boundary.

To smoke-test the actual HTTP routes against the local Supabase stack (no
Asaas account needed — this only proves the route's own plumbing: token
check, company lookup, RPC call):

```bash
# .env.local: set ASAAS_WEBHOOK_TOKEN and CRON_SECRET to any local value,
# SUPABASE_SERVICE_ROLE_KEY to the local stack's service_role key.

curl -X POST http://localhost:3000/api/billing/sweep \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST http://localhost:3000/api/billing/webhook \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -d '{
    "event": "PAYMENT_CONFIRMED",
    "payment": {
      "id": "pay_test1", "customer": "cus_test1",
      "value": 24.90, "status": "CONFIRMED", "dueDate": "2026-12-01"
    }
  }'
```

(The second call only does anything if some `subscriptions` row already has
`external_customer_id = 'cus_test1'` — in production that link is written by
`createCheckoutSession` before the owner is ever redirected to pay.)
