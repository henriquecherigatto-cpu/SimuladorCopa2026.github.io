# WhatsApp integration (Meta Cloud API)

How a public booking's confirmation reaches the customer's WhatsApp, how a
customer can self-cancel from that message, how each barbershop connects its
own WhatsApp Business Account, and what it takes to point this at a real
Meta for Developers app.

This replaced an earlier Twilio-based integration (one shared sender for
every company). The Meta Cloud API migration is genuinely multi-tenant:
**each company connects its own WhatsApp Business Account** via Meta's
Embedded Signup, so there is no single "the" provider anymore, only "company
X's own connection."

## Where each piece lives

| Concern | File |
| --- | --- |
| Provider-agnostic types | `src/lib/whatsapp/types.ts` |
| Meta Cloud API adapter (HTTP calls to the Graph API) | `src/lib/whatsapp/meta-cloud-api.ts` |
| Provider picker (company-scoped) | `src/lib/whatsapp/provider.ts` |
| Access-token encryption (AES-256-GCM) | `src/lib/whatsapp/token-crypto.ts` |
| Message composition + send-on-booking | `src/lib/whatsapp/send-booking-confirmation.ts` |
| Grace-period reminder to the barbershop itself | `src/lib/actions/subscription-notifications.ts` |
| Connection schema (`whatsapp_connections`, encrypted token, status) | `supabase/migrations/20260101000036_whatsapp_cloud_api_schema.sql` |
| Delivery-status enum (`delivered`/`read`) | `supabase/migrations/20260101000035_whatsapp_cloud_api_enum.sql` |
| Connect/disconnect/test-send Server Actions | `src/lib/actions/whatsapp-connection.ts` |
| Configurações UI (Embedded Signup button, status, test-send) | `src/components/configuracoes/WhatsAppConnectionModal.tsx` |
| Webhook (verification handshake + signed status/inbound events) | `src/app/api/webhooks/whatsapp/route.ts` |
| Plan + subscription-status gate (Profissional-only, `ativa` only) | `supabase/migrations/20260101000034_whatsapp_confirmation_subscription_gate.sql` |
| Cancel-by-link schema (`cancel_token`, lookup/cancel functions) | `supabase/migrations/20260101000021_photos_whatsapp_cancellation.sql` |
| Automated tests (mocked — see "Testing" below) | `src/lib/whatsapp/*.test.ts`, `src/app/api/webhooks/whatsapp/route.test.ts`, `supabase/tests/negative/180_whatsapp_connections_isolation.sql` |

## The security properties this is built around

**A WhatsApp send failure can never undo or block a booking that already
succeeded.** `sendBookingConfirmation()` runs after `create_public_appointment`
has already committed, wrapped in a `.catch()` that only logs — the customer
always sees their booking confirmed on-screen even if Meta is unreachable,
the company's connection is broken, or the access token has expired.

**Every company's credentials, status, and message history are isolated —
at both the backend and the database level.** `whatsapp_connections` has
exactly one row per company, Row Level Security enabled with **zero
policies** (no role, not even the connected company's own owner, can read
or write it with a plain query), and every read/write goes exclusively
through `security definer` functions (`get_whatsapp_connection_status`,
`set_whatsapp_connection`, `clear_whatsapp_connection`) that re-derive the
caller's company membership from their own verified session
(`has_company_role`) — never from a company id the client sends. Passing a
different company's id changes nothing: the function checks whether *the
authenticated caller* belongs to *that* company, not whether the id looks
valid. See `supabase/tests/negative/180_whatsapp_connections_isolation.sql`
for the automated proof, including the same guarantee for the webhook's
opt-out phone-matching (scoped by which company owns the inbound
`phone_number_id`, never by phone digits alone).

**The access token is encrypted before it ever reaches the database, with a
key that is never stored in the database.** `token-crypto.ts` encrypts it
(AES-256-GCM) in the Server Action, before the one write to
`whatsapp_connections`; `WHATSAPP_TOKEN_ENCRYPTION_KEY` lives only in the
server's own environment. A stolen database dump is useless without that
separate secret. The token is never returned to the browser, never logged,
and never appears in an API response — `get_whatsapp_connection_status()`'s
`returns table` simply has no such column.

**The cancel link's token is not the appointment's id.** Unchanged from the
Twilio-era design — see `cancel_token` (`appointments_cancel_token_key`,
unique), `get_public_appointment_by_token()` (read-only) and
`cancel_appointment_by_token()` (the only thing that writes
`status = 'cancelado'`, only from an explicit confirm-dialog button press).

**Duplicate sends are prevented, not just retried-and-hoped-against.**
Before sending, `sendBookingConfirmation()` checks whether a non-failed
`booking_confirmation` row already exists for that appointment in
`whatsapp_messages` — covering both a retried Server Action and a duplicate
webhook-driven anything. Delivery-status updates themselves are monotonic
(`update_whatsapp_message_status()`): `sent → delivered → read`, `failed`
terminal, so Meta's at-least-once, possibly out-of-order webhook delivery
can never move a message backward.

**Consent is checked, and opt-out is respected.** A customer who opts in by
typing their own phone number into the booking form has, by that action,
implicitly consented to a transactional confirmation about the booking they
just made. Replying with a stop keyword (`parar`, `sair`, `cancelar`,
`stop`, `descadastrar`) to the company's WhatsApp number flips
`customers.whatsapp_opt_out` permanently (until they book again), checked
by `sendBookingConfirmation()` before every send.

## Architecture: per-company connections, Embedded Signup

Each barbershop owner connects their own WhatsApp Business Account from
**Configurações → Integração com WhatsApp**:

1. The owner clicks "Conectar conta do WhatsApp." The browser loads Meta's
   JavaScript SDK and opens `FB.login()` scoped to a pre-created Embedded
   Signup configuration (`config_id`) — this is Meta's own official
   authorization flow for software providers connecting WhatsApp Business
   Accounts on behalf of their users; the owner is never asked to paste a
   token.
2. Two things come back from that one flow, which the client-side code
   (`WhatsAppConnectionModal.tsx`) collects together: a short-lived
   authorization `code` (from `FB.login`'s own callback) and the
   `waba_id`/`phone_number_id` the owner selected or registered (from a
   `postMessage` event the embedded flow sends separately).
3. The browser sends those three values to `connectWhatsAppAccount()`
   (`src/lib/actions/whatsapp-connection.ts`), which runs entirely
   server-side: exchanges the `code` for a real access token via Meta's
   standard OAuth endpoint (`GET /oauth/access_token`, using the
   platform's own `META_APP_ID`/`META_APP_SECRET`), confirms that token can
   actually read the reported `phone_number_id`, encrypts it, and stores it.
   The plaintext token exists only in that one server-side scope.

This is the one piece of the whole integration whose exact client-side
contract (the FB SDK call shape, the `postMessage` payload shape) depends
most directly on Meta's own Embedded Signup product, which evolves
independently of this codebase — verify it against your real Meta App and
Embedded Signup configuration during setup (step 3 below), since it cannot
be exercised against a real Meta backend from this repository's own test
suite.

## Setting up the platform-wide Meta App

These steps configure the *platform's own* Meta app — the thing that makes
Embedded Signup and the Cloud API available at all. They're separate from
any individual barbershop connecting their own number (which happens
entirely inside the app, no Meta for Developers access needed by the
barbershop owner).

1. **Create a Meta app**: <https://developers.facebook.com/apps> → Create
   App → use case "Other" → type "Business." Note the **App ID** and (App
   settings → Basic) **App Secret**.
2. **Add the WhatsApp product**: App Dashboard → Add Product → WhatsApp →
   Set up. This provisions a test WABA and test phone number you can send
   to immediately, with no business verification — useful for the steps
   below before going live.
3. **Create an Embedded Signup configuration**: WhatsApp → Embedded Signup
   → Configurations → Create configuration. Choose the WhatsApp Business
   app type ("Tech provider" — this app connects WhatsApp accounts *on
   behalf of* its own users, the barbershops), and note the resulting
   **Configuration ID**.
4. **Environment variables** — set in `.env.local` (development) and your
   deployment's environment settings (production). See `.env.example` for
   the exact names and comments; summarized:
   - `META_APP_ID`, `META_APP_SECRET` — server-only, from step 1.
   - `META_GRAPH_API_VERSION` — optional, defaults to `v21.0`.
   - `META_WEBHOOK_VERIFY_TOKEN` — a secret **you** choose (see "Webhook
     setup" below).
   - `WHATSAPP_TOKEN_ENCRYPTION_KEY` — generate with `openssl rand -hex 32`.
   - `NEXT_PUBLIC_META_APP_ID` — the **same value** as `META_APP_ID`. Safe
     to expose: Meta's own JS SDK always takes a public app id (same trust
     model as `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
   - `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID` — the Configuration ID
     from step 3. Also not a secret — it only selects which signup flow to
     launch.
   - `NEXT_PUBLIC_META_GRAPH_API_VERSION` — optional, mirrors
     `META_GRAPH_API_VERSION` for the client-side SDK.

Leaving all of these unset is a valid, deliberate state during development:
the Configurações screen shows "Desconectado" with a clear message instead
of a working connect button, and a public booking still succeeds exactly as
before — it just never sends the WhatsApp confirmation.

## Message templates

WhatsApp only allows a **business-initiated** message (one the recipient
didn't message first to open a 24-hour session) through a template Meta has
pre-approved — never free-form text. The template **name** sent to Meta is
exactly the `WhatsAppTemplate` value used in code (`"booking_confirmation"`
/ `"subscription_grace_reminder"`) — create templates in Meta Business
Manager (WhatsApp Manager → Account tools → Message templates) with
**these exact names**.

### `booking_confirmation`

1. Category: **Utility** (a transactional notification tied to an action
   the customer took, not marketing — Utility also approves faster).
2. Language: Portuguese (BR).
3. Body, exactly (five numbered variables, in this order — the code in
   `sendBookingConfirmation()` fills them in this order and nothing else
   reads the template, so wording around the variables can be adjusted
   freely, but the **order** of `{{1}}`..`{{5}}` cannot):
   ```
   Olá! Seu agendamento na {{1}} está confirmado: {{2}} com {{3}}, {{4}}. Não poderá comparecer? Cancele por aqui: {{5}}
   ```
   (`{{1}}` company name, `{{2}}` service, `{{3}}` professional, `{{4}}`
   date/time already formatted in Portuguese, `{{5}}` the cancel link.)
4. Submit for approval. Utility templates are typically approved within
   minutes to a few hours.

### `subscription_grace_reminder`

Sent to the **barbershop's own number** (`companies.whatsapp_number`), not
any customer, the moment its subscription enters the post-`vencimento`
grace period.

1. Category: **Utility** (a transactional notice tied to the account's own
   billing state).
2. Language: Portuguese (BR).
3. Body, exactly (three numbered variables, in this order):
   ```
   Olá, {{1}}! Não identificamos o pagamento da sua assinatura do Easy Barber. Você tem {{2}} dia(s) para regularizar antes que o sistema seja bloqueado automaticamente em {{3}}. Qualquer dúvida, é só responder esta mensagem.
   ```
   (`{{1}}` company name, `{{2}}` days remaining, `{{3}}` the exact block
   date, formatted `dd/MM/yyyy`.)
4. Submit for approval.

Unlike Twilio's Content SID, there is no id to copy into an env var — the
adapter references each template by the name above directly, so once
approved in Meta Business Manager it works for every connected company
with no further configuration. A company whose connection isn't configured,
or a template that isn't yet approved, makes `isConfigured()` return
`false` and the send is skipped (logged, never thrown).

## Webhook setup

Register `https://<your-deployment>/api/webhooks/whatsapp` in Meta App
Dashboard → WhatsApp → Configuration → Webhook, and subscribe to the
`messages` field (covers both outbound delivery-status updates and inbound
customer replies, e.g. opt-out keywords).

This endpoint implements **two genuinely distinct mechanisms** — conflating
them is the most common webhook bug:

- **GET — the one-time verification handshake.** Meta calls this once when
  you register the URL, with `hub.mode`, `hub.verify_token`, and
  `hub.challenge` query params. The handler checks `hub.verify_token`
  against `META_WEBHOOK_VERIFY_TOKEN` — a value **you** choose when
  registering the webhook, not provided by Meta — and echoes back
  `hub.challenge` if it matches.
- **POST — every actual event delivery afterward.** Verified via the
  `X-Hub-Signature-256` header: an HMAC-SHA256 of the raw request body,
  keyed with `META_APP_SECRET`. An unsigned or incorrectly-signed request
  is rejected with 401 before its body is ever parsed — no unauthenticated
  status update is accepted.

Both mechanisms, and the signature verification specifically, are covered
by `src/app/api/webhooks/whatsapp/route.test.ts` (valid signature, tampered
body, missing header, wrong secret — all mocked, no real Meta calls).

## Multi-tenant permissions needed in production

Beyond the app's own test WABA/number (usable immediately, no review
needed), sending to real customers at scale requires Meta's App Review for
the `whatsapp_business_management` and `whatsapp_business_messaging`
permissions — this is Meta's own process (business verification, a
screencast of the Embedded Signup flow, a privacy policy URL) and is
**external to this codebase**: nothing here can complete it on your behalf.

## Testing

Three layers, all using mocks — **no automated test sends a real message or
incurs a real charge**:

- `src/lib/whatsapp/meta-cloud-api.test.ts` — the adapter itself: a valid
  send, an invalid-credentials/API-error response (not retried), a
  rejected phone number (not retried), a rate-limited response (retried),
  a thrown network/timeout error (retried), and "not configured" when no
  connection exists.
- `src/lib/whatsapp/send-booking-confirmation.test.ts` — the composition
  layer: the happy path; a send failure that still completes without
  throwing (the appointment is never affected); duplicate-send prevention;
  blocking a customer who opted out; blocking an ineligible plan/
  subscription (including fail-closed on an eligibility-check error);
  blocking when no connection is configured; and doing nothing at all for
  a booking that was never found.
- `src/app/api/webhooks/whatsapp/route.test.ts` — the webhook: the
  verification handshake, and signature validation (valid, tampered,
  missing, wrong secret), plus a correct delivery-status update and an
  inbound opt-out reply.
- `src/lib/whatsapp/no-twilio.test.ts` — confirms the active send path
  (`provider.ts` and its real callers) imports nothing from the old Twilio
  adapter and references no `TWILIO_*` env var.
- `supabase/tests/negative/180_whatsapp_connections_isolation.sql` —
  DB-level: owner-only connection management, zero direct table access
  (even for the connected company's own owner), cross-company isolation
  for every function (including the webhook's opt-out phone-matching),
  service_role-only access to the error/status/opt-out functions, and the
  monotonic delivery-status progression.

Run them with `npm test` (Vitest) and
`bash supabase/tests/run-local-tests.sh` (the full SQL negative-test suite)
respectively.

### Verifying it without a real Meta account

All of the above runs with zero Meta credentials configured. To see a real
send with the app's own test number (no business verification needed): use
the test WABA/number from "Setting up the platform-wide Meta App" step 2,
connect it from Configurações like any other company would, and use the
**"Enviar mensagem de teste"** button (requires an explicit confirmation —
this is the one place in the whole integration that's *meant* to send a
real message outside the mocked test suite). A send failure logs
`WhatsApp confirmation send failed (meta_cloud_api): <reason>` and — for a
real send attempt, not a "not configured" skip — also flips that company's
connection status to `error` with the reason attached, visible back in
Configurações.
