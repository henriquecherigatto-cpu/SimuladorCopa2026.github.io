# WhatsApp integration (Twilio)

How a public booking's confirmation reaches the customer's WhatsApp, how a
customer can self-cancel from that message, and what it takes to point this
at a real Twilio account.

## Where each piece lives

| Concern | File |
| --- | --- |
| Provider-agnostic types | `src/lib/whatsapp/types.ts` |
| Twilio adapter (HTTP call to the Messages API) | `src/lib/whatsapp/twilio.ts` |
| Provider picker (the one swap point) | `src/lib/whatsapp/provider.ts` |
| Message composition + send-on-booking | `src/lib/actions/public-booking.ts` (`sendBookingConfirmation`) |
| Cancel-by-link schema (`cancel_token`, lookup/cancel functions) | `supabase/migrations/20260101000021_photos_whatsapp_cancellation.sql` |
| Cancel-by-link tests | `supabase/tests/negative/100_public_cancellation.sql` |
| Cancel page | `src/app/cancelar/[token]/page.tsx`, `src/components/cancelar/CancelAppointmentClient.tsx` |
| Owner's own WhatsApp number field | `src/lib/actions/companies.ts` (`updateCompanySettings`), `src/components/configuracoes/ConfiguracoesPageClient.tsx` |

## The security property this is built around

**A WhatsApp send failure can never undo or block a booking that already
succeeded.** `sendBookingConfirmation()` runs after `create_public_appointment`
has already committed, wrapped in a `.catch()` that only logs — the customer
always sees their booking confirmed on-screen even if Twilio is unreachable,
unconfigured, or rejects the number.

**The cancel link's token is not the appointment's id.** `cancel_token` is a
separate random `uuid` column (`appointments_cancel_token_key`, unique) —
exposing it in a WhatsApp message or a "consultar meu agendamento" lookup
never also hands out a way to cancel a *different* appointment whose id a
visitor might guess or already hold. Reading and cancelling are also split
at the function level:

- `get_public_appointment_by_token()` is read-only (`stable`) — safe for a
  bare page visit, including a messaging app's link-preview bot fetching the
  URL before a human taps it.
- `cancel_appointment_by_token()` is the only thing that writes
  `status = 'cancelado'`, and the client only ever calls it from an explicit
  confirm-dialog button press (`CancelAppointmentClient`), never on page
  load.

Both are `security definer` with `search_path` pinned and granted narrowly to
`anon`/`authenticated` — same pattern as the other public-booking functions
in `20260101000018_public_booking.sql`. A malformed or unknown token returns
`{"found": false}` from both, never a Postgres error, so the cancel page
can't be used to probe which tokens are real.

## Going live

1. **Create a Twilio account**: <https://www.twilio.com/try-twilio> (free to
   start — the Sandbox below needs no business verification or payment
   method).
2. **Join the WhatsApp Sandbox**: Twilio Console → Messaging → Try it out →
   Send a WhatsApp message. It gives you a sandbox number (this is
   per-account — ours came out `+1 737 250 8034`, not Twilio's old generic
   `+1 415 523 8886`, so always read the actual number off this page rather
   than assuming) and a join keyword (e.g. `join twilio-trial`) — send that
   exact phrase from the phone you want to test with, once, to opt it in.
   Each opt-in is good for 72 hours; after that, send the join phrase again.
3. **Credentials**: Console → Account → API keys & tokens gives you the
   Account SID and Auth Token. Set `TWILIO_ACCOUNT_SID` and
   `TWILIO_AUTH_TOKEN`.
4. **Sender number**: set `TWILIO_WHATSAPP_FROM=whatsapp:+<your sandbox
   number>` while testing. Moving to production means applying for a
   WhatsApp Business sender in the Twilio Console (Twilio guides you through
   Meta's business verification) and swapping this one value — nothing else
   changes.
5. **Content Template** (required — a plain-text send is rejected): a
   booking confirmation is *business-initiated* — the customer never
   messaged first to open a 24-hour session — and WhatsApp only allows a
   business-initiated message through a template Meta has pre-approved, never
   free-form text. Skipping this step is exactly what produced the
   `"ContentSid Required"` error during our own first real test. To fix it:
   1. Twilio Console → Messaging → Content Template Builder → Create new →
      WhatsApp → Text.
   2. Category: **Utility** (this is a transactional notification tied to an
      action the customer took, not marketing — Utility also approves
      faster).
   3. Language: Portuguese (Brazil).
   4. Body, exactly (five numbered variables, in this order — the code in
      `sendBookingConfirmation()` fills them in this exact order and nothing
      else reads the template, so the wording around the variables can be
      adjusted freely, but the **order** of `{{1}}`..`{{5}}` cannot):
      ```
      Olá! Seu agendamento na {{1}} está confirmado: {{2}} com {{3}}, {{4}}. Não poderá comparecer? Cancele por aqui: {{5}}
      ```
      (`{{1}}` company name, `{{2}}` service, `{{3}}` professional, `{{4}}`
      date/time already formatted in Portuguese, `{{5}}` the cancel link.)
   5. Submit for WhatsApp approval. Utility templates are typically approved
      within minutes to a few hours, not days.
   6. Once approved, copy its Content SID (starts `HX...`) into
      `TWILIO_CONTENT_SID`.
6. **Owner's own number**: each barbershop sets its own WhatsApp number from
   Configurações (owner-only) — that's the number the "Falar no WhatsApp"
   floating button on the public booking page opens a chat with. It's
   independent from the `TWILIO_*` vars above: those control the
   barbershop's *outgoing automated confirmation*, sent from the platform's
   one shared Twilio sender to the customer; the Configurações number is
   what the *customer* messages back, by hand, on their own WhatsApp. Every
   company on the platform shares the same `TWILIO_*` sender and template —
   see "One shared sender, not one per company" below for why.

Leaving the four `TWILIO_*` vars unset is a valid, deliberate state during
development — `isConfigured("booking_confirmation")` returns `false`,
`sendBookingConfirmation()` returns early, and a public booking still
succeeds exactly as before; it just never sends the WhatsApp message.

## Second template: subscription grace-period reminder

A second, unrelated business-initiated message: the moment a company's
subscription enters the post-`vencimento` grace period (the daily sweep
moves it `ativa` → `tolerancia` — see
`supabase/migrations/20260101000017_subscription_lifecycle.sql`),
`notifyCompanyEnteringGracePeriod()` (`src/lib/actions/subscription-notifications.ts`)
WhatsApps the **barbershop's own number** (`companies.whatsapp_number`,
not the platform's support line and not any customer) saying how many days
remain before the system blocks new bookings.

WhatsApp approval is per exact template wording, not a blanket "this
account can send templates" — so this needs its own Content Template and
its own Content SID, entirely separate from the booking confirmation's:

1. Twilio Console → Messaging → Content Template Builder → Create new →
   WhatsApp → Text.
2. Category: **Utility** (same reasoning as the booking confirmation — a
   transactional notice tied to the account's own billing state, not
   marketing).
3. Language: Portuguese (Brazil).
4. Body, exactly (three numbered variables, in this order — the code in
   `notifyCompanyEnteringGracePeriod()` fills them in this exact order):
   ```
   Olá, {{1}}! Não identificamos o pagamento da sua assinatura do Easy Barber. Você tem {{2}} dia(s) para regularizar antes que o sistema seja bloqueado automaticamente em {{3}}. Qualquer dúvida, é só responder esta mensagem.
   ```
   (`{{1}}` company name, `{{2}}` days remaining, `{{3}}` the exact block
   date, already formatted `dd/MM/yyyy`.)
5. Submit for WhatsApp approval, then copy its Content SID (`HX...`) into
   `TWILIO_CONTENT_SID_GRACE_REMINDER`.

Leaving `TWILIO_CONTENT_SID_GRACE_REMINDER` unset is independent from the
booking-confirmation template: `isConfigured("subscription_grace_reminder")`
returns `false` and the sweep route's own response still succeeds exactly
as before (the state machine transition itself is never gated on this),
it just never sends this particular message — the booking-confirmation
template can be fully working while this one isn't configured yet, or
vice versa.

## One shared sender, not one per company

This is a multi-tenant product — many companies, one deployment. The
automated confirmation is sent from **one** WhatsApp sender shared by every
company (the `TWILIO_WHATSAPP_FROM` configured above), not from each
barbershop's own number. The message text still says which barbershop it's
about (`{{1}}` in the template), but the number the customer sees as the
sender is always the platform's.

The alternative — each company sending from its own WhatsApp number — would
require every single company that signs up to separately complete Meta's
WhatsApp Business verification (a real-business check, CNPJ, days of lead
time) before online booking would even work for them. That's friction on
every new signup for a property this app already covers a different way:
the "Falar no WhatsApp" floating button opens a chat with the barbershop's
*own* number (`companies.whatsapp_number`) for anything the customer wants
to say back. Only the one-way, automated confirmation goes out from the
shared sender.

## Verifying it without a real Twilio account

The cancellation schema itself needs no provider at all — see
`bash supabase/tests/run-local-tests.sh`, which runs
`100_public_cancellation.sql` covering lookup-by-token, unknown/malformed
tokens, idempotent re-cancel, the slot reopening afterwards, and the
past/concluded-appointment guards — all against real
`create_public_appointment` bookings, no Twilio call involved.

To see the actual variables Twilio would receive without sending anything,
temporarily log `templateVariables` inside `sendBookingConfirmation()`
(`src/lib/actions/public-booking.ts`) — with the four `TWILIO_*` vars unset,
`isConfigured()` is `false` and nothing is sent, but you can still exercise
the rest of the booking flow end-to-end against the local Supabase stack.

Once you've joined the Sandbox (step 2 above), created and had the Content
Template approved (step 5), and set real values for all four vars in
`.env.local`, a real public booking through `/agendar/<slug>` sends a real
WhatsApp message to whatever phone number the customer entered — as long as
that number already joined the Sandbox too (production, post-verification,
has no such restriction). A send that fails logs
`WhatsApp confirmation send failed (twilio): <reason>` — in Vercel this
shows up under the deployment's Runtime Logs, which is how the
`"ContentSid Required"` error that led to step 5 above was actually found.
