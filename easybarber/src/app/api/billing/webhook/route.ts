import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/billing/provider";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * Payment-provider webhook endpoint. This is the ONLY path in the
 * entire application that can move a subscription into 'ativa' — not
 * a Server Action, not anything reachable from the browser. Every
 * step below exists to make that statement true even against a
 * malicious or buggy client:
 *
 *   1. Read the raw body as text, UNPARSED, so signature/token
 *      verification runs over the exact bytes the provider sent.
 *   2. Verify the request is genuinely from the configured provider
 *      BEFORE trusting a single field of its payload.
 *   3. Resolve which company this event belongs to from OUR OWN
 *      database (subscriptions.external_customer_id), never from
 *      anything the request claims about itself.
 *   4. Hand off to apply_billing_event() via the service_role client
 *      — the one client in the codebase allowed to call it — which
 *      is itself idempotent on (provider, provider_event_id).
 *
 * A browser redirect back from checkout is handled entirely
 * separately (see src/lib/actions/billing.ts) and never reaches this
 * file or calls apply_billing_event at all.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const provider = getPaymentProvider();

  if (!provider.verifyWebhookRequest(request.headers, rawBody)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = provider.parseWebhookEvent(rawBody);
  } catch (err) {
    console.error("billing webhook: malformed payload", err);
    return NextResponse.json({ error: "malformed payload" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: subscription, error: lookupError } = await supabase
    .from("subscriptions")
    .select("company_id")
    .eq("external_customer_id", event.externalCustomerId)
    .maybeSingle();

  if (lookupError) {
    console.error("billing webhook: subscription lookup failed", lookupError);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  if (!subscription) {
    // No company links to this provider customer id yet. We ack with
    // 200 rather than let the provider retry forever — if this ever
    // fires in practice it means createCheckoutSession's
    // external_customer_id write (src/lib/actions/billing.ts) didn't
    // happen or used a different id, which is a bug to fix, not a
    // transient condition retries would resolve.
    console.error(
      "billing webhook: no subscription found for external_customer_id",
      event.externalCustomerId,
      event,
    );
    return NextResponse.json({ ok: true, matched: false });
  }

  const { data, error } = await supabase.rpc("apply_billing_event", {
    p_provider: event.provider,
    p_provider_event_id: event.providerEventId,
    p_company_id: subscription.company_id,
    p_event_type: event.eventType,
    // apply_billing_event's p_amount_cents/p_new_period_end are plain
    // nullable SQL params (no NOT NULL constraint) — the generated
    // Database type doesn't express that nullability, so these two
    // casts are just bridging that gap, not papering over a real type
    // mismatch.
    p_amount_cents: event.amountCents as number,
    p_status: event.status,
    p_raw_payload: event.rawPayload as never,
    p_new_period_end: event.newPeriodEnd as string | undefined,
  });

  if (error) {
    console.error("billing webhook: apply_billing_event failed", error);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
