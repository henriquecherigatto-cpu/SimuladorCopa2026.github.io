/**
 * Shapes shared between a payment-provider adapter (e.g. src/lib/billing/asaas.ts)
 * and the code that drives the subscription state machine
 * (supabase/migrations/20260101000017_subscription_lifecycle.sql).
 *
 * A provider adapter's job is narrow and purely mechanical: speak the
 * provider's HTTP API and webhook payload shape, and translate it
 * into these provider-agnostic types. It never touches the database
 * and never decides what a payment means for a subscription — that
 * decision lives entirely in apply_billing_event(), so swapping
 * providers later never requires touching the state machine or its
 * tests.
 */

/**
 * The state machine's own small vocabulary of event types (matches
 * the `case` branches in apply_billing_event()). A provider adapter
 * maps its own event/status names onto these; anything that doesn't
 * map to one of them should still be forwarded as its own string —
 * apply_billing_event() logs-and-ignores event types it doesn't
 * recognize rather than erroring, so new provider events never break
 * the handler.
 */
export type CanonicalBillingEventType =
  | "payment_confirmed"
  | "payment_overdue"
  | "subscription_canceled"
  | (string & {});

/**
 * One webhook event, parsed from the provider's payload but not yet
 * resolved to a company — only the provider's own identifier for
 * "who this charge belongs to" (e.g. their customer id). Resolving
 * that to a company_id requires a database lookup
 * (subscriptions.external_customer_id), which is deliberately done by
 * the route handler with the service-role client, not by the
 * provider adapter — the adapter has no database access at all.
 */
export interface RawBillingEvent {
  provider: string;
  providerEventId: string;
  externalCustomerId: string;
  eventType: CanonicalBillingEventType;
  amountCents: number | null;
  /** The provider's own raw status string, stored as-is for audit/debugging. */
  status: string;
  rawPayload: unknown;
  /** ISO date (YYYY-MM-DD) of the next charge, when the provider includes one. */
  newPeriodEnd?: string;
}

export interface CreateCheckoutSessionInput {
  companyId: string;
  planId: string;
  planName: string;
  priceCents: number;
  customerName: string;
  customerEmail: string;
  /** CPF/CNPJ — Brazilian payment providers generally require this to issue an invoice. */
  customerDocument: string;
  /** Existing provider customer id, if this company has already checked out before. */
  existingExternalCustomerId: string | null;
  /**
   * Where the provider redirects the browser after checkout. This is
   * display-only — "you'll see your subscription update once we
   * confirm the payment" — and must NEVER be read as proof of
   * payment. Only a verified webhook event, processed through
   * apply_billing_event(), ever changes subscriptions.status.
   */
  returnUrl: string;
}

export interface CheckoutSession {
  /** Hosted checkout URL to redirect the owner's browser to. */
  url: string;
  externalCustomerId: string;
}

/**
 * A payment provider adapter. Card data never passes through any
 * method here — createCheckoutSession hands the browser off to the
 * provider's own hosted checkout (or returns a provider-hosted
 * payment-method iframe URL), so this application never receives,
 * transmits or stores raw card numbers at any point.
 */
export interface PaymentProvider {
  readonly name: string;

  /** False when the required API credentials aren't set (e.g. local/dev). */
  isConfigured(): boolean;

  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;

  /**
   * Verifies the webhook request genuinely came from the provider,
   * BEFORE any of its payload is trusted. Must run on the raw request
   * (headers + exact body bytes) — never on a body that's already
   * been JSON-parsed and re-serialized, since re-serialization is not
   * guaranteed to reproduce the exact bytes a signature was computed
   * over.
   */
  verifyWebhookRequest(headers: Headers, rawBody: string): boolean;

  /** Only call after verifyWebhookRequest() has returned true. */
  parseWebhookEvent(rawBody: string): RawBillingEvent;
}
