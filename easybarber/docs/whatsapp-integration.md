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
   Send a WhatsApp message. It gives you a sandbox number (usually
   `+1 415 523 8886`) and a join code — send that code from the phone you
   want to test with, once, to opt that number in.
3. **Credentials**: Console → Account → API keys & tokens gives you the
   Account SID and Auth Token. Set `TWILIO_ACCOUNT_SID` and
   `TWILIO_AUTH_TOKEN`.
4. **Sender number**: set `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` (the
   sandbox number, with the `whatsapp:` prefix Twilio's API requires) while
   testing. Moving to production means applying for a WhatsApp Business
   sender in the Twilio Console (Twilio guides you through Meta's business
   verification) and swapping this one value — nothing else in the code
   changes.
5. **Owner's own number**: each barbershop sets its own WhatsApp number from
   Configurações (owner-only) — that's the number the "Falar no WhatsApp"
   floating button on the public booking page opens a chat with. It's
   independent from the three `TWILIO_*` vars above: those control the
   barbershop's *outgoing automated confirmation*, sent from the shop's
   Twilio sender to the customer; the Configurações number is what the
   *customer* messages back, by hand, on their own WhatsApp.

Leaving the three `TWILIO_*` vars unset is a valid, deliberate state during
development — `isConfigured()` returns `false`, `sendBookingConfirmation()`
returns early, and a public booking still succeeds exactly as before; it
just never sends the WhatsApp message.

## Verifying it without a real Twilio account

The cancellation schema itself needs no provider at all — see
`bash supabase/tests/run-local-tests.sh`, which runs
`100_public_cancellation.sql` covering lookup-by-token, unknown/malformed
tokens, idempotent re-cancel, the slot reopening afterwards, and the
past/concluded-appointment guards — all against real
`create_public_appointment` bookings, no Twilio call involved.

To see the actual message Twilio would receive without sending anything,
temporarily log `body` inside `sendBookingConfirmation()`
(`src/lib/actions/public-booking.ts`) — with the three `TWILIO_*` vars unset,
`isConfigured()` is `false` and nothing is sent, but you can still exercise
the rest of the booking flow end-to-end against the local Supabase stack.

Once you've joined the Sandbox (step 2 above) and set real values for all
three vars in `.env.local`, a real public booking through `/agendar/<slug>`
sends a real WhatsApp message to whatever phone number the customer entered
— as long as that number already joined the Sandbox too (production,
post-verification, has no such restriction).
