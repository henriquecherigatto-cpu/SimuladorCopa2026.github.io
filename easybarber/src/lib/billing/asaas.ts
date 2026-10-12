import "server-only";
import { timingSafeEqual } from "node:crypto";
import type {
  CheckoutSession,
  CreateCheckoutSessionInput,
  PaymentProvider,
  RawBillingEvent,
} from "@/lib/billing/types";

/**
 * Asaas (https://www.asaas.com) adapter — a Brazilian payment
 * provider supporting Pix, boleto and card, which fits the app's R$
 * pricing. Nothing here is wired to a live account yet: without
 * ASAAS_API_KEY configured, isConfigured() is false and
 * createCheckoutSession() throws a clear configuration error instead
 * of pretending to succeed. Flipping it on in production is then just
 * setting the three env vars below — no code changes.
 *
 * Card data never touches this server: createCheckoutSession()
 * creates an Asaas customer + subscription via their REST API, then
 * hands back the `invoiceUrl` of the first generated charge — a page
 * hosted on asaas.com where the payer picks Pix/boleto/card and, for
 * card, types the number directly into Asaas's own form. This server
 * never receives or stores a card number, a CVV, or any tokenized
 * payment-method reference.
 */
export class AsaasProvider implements PaymentProvider {
  readonly name = "asaas";

  private get apiKey() {
    return process.env.ASAAS_API_KEY;
  }

  private get webhookToken() {
    return process.env.ASAAS_WEBHOOK_TOKEN;
  }

  private get baseUrl() {
    return process.env.ASAAS_API_BASE_URL || "https://api-sandbox.asaas.com/v3";
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.webhookToken;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.apiKey) {
      throw new Error("ASAAS_API_KEY is not configured.");
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        access_token: this.apiKey,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Asaas API ${path} failed: ${res.status} ${body}`);
    }
    return res.json() as Promise<T>;
  }

  private async findOrCreateCustomer(input: CreateCheckoutSessionInput): Promise<string> {
    if (input.existingExternalCustomerId) {
      return input.existingExternalCustomerId;
    }

    const existing = await this.request<{ data: { id: string }[] }>(
      `/customers?cpfCnpj=${encodeURIComponent(input.customerDocument)}`,
    );
    if (existing.data.length > 0) {
      return existing.data[0].id;
    }

    const created = await this.request<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.customerName,
        email: input.customerEmail,
        cpfCnpj: input.customerDocument,
      }),
    });
    return created.id;
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    if (!this.isConfigured()) {
      throw new Error(
        "O provedor de pagamento ainda não está configurado (ASAAS_API_KEY/ASAAS_WEBHOOK_TOKEN ausentes).",
      );
    }

    const customerId = await this.findOrCreateCustomer(input);

    // billingType: "UNDEFINED" lets the payer choose Pix, boleto or
    // card on Asaas's own hosted invoice page — we never ask them to
    // pick (or collect) a payment method ourselves.
    const subscription = await this.request<{ id: string }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        cycle: "MONTHLY",
        value: input.priceCents / 100,
        description: `Easy Barber — ${input.planName}`,
        nextDueDate: new Date().toISOString().slice(0, 10),
        externalReference: input.companyId,
      }),
    });

    const payments = await this.request<{ data: { id: string; invoiceUrl: string }[] }>(
      `/payments?subscription=${subscription.id}`,
    );
    const firstInvoice = payments.data[0];
    if (!firstInvoice) {
      throw new Error("Asaas subscription created but no invoice was generated.");
    }

    return { url: firstInvoice.invoiceUrl, externalCustomerId: customerId };
  }

  // rawBody is part of the PaymentProvider interface (some providers
  // sign over the body) but Asaas's own scheme is a static shared
  // token header, independent of the payload — so it's unused here.
  verifyWebhookRequest(headers: Headers): boolean {
    if (!this.webhookToken) return false;

    // Asaas sends back the static token configured for the webhook
    // endpoint (set when registering it — see docs/billing-integration.md)
    // as this header on every delivery. It's a shared-secret
    // comparison, not an HMAC over the body, so the body itself isn't
    // part of the check — but the token alone is what proves the
    // request came from Asaas and not an arbitrary caller who found
    // the URL.
    const received = headers.get("asaas-access-token");
    if (!received) return false;

    const expected = Buffer.from(this.webhookToken);
    const actual = Buffer.from(received);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  }

  parseWebhookEvent(rawBody: string): RawBillingEvent {
    const payload = JSON.parse(rawBody) as {
      event: string;
      id?: string;
      payment?: {
        id: string;
        customer: string;
        value: number;
        status: string;
        dueDate?: string;
      };
      subscription?: { id: string; customer: string };
    };

    const eventType = mapAsaasEvent(payload.event);
    const payment = payload.payment;
    const externalCustomerId = payment?.customer ?? payload.subscription?.customer ?? "";

    return {
      provider: this.name,
      // Asaas doesn't send a dedicated webhook-delivery id in older
      // API versions; the payment id + event name is unique enough
      // per delivery for our idempotency key, and if Asaas redelivers
      // the exact same (event, payment) pair, that's exactly the
      // at-least-once replay apply_billing_event() is built to ignore.
      providerEventId: `${payload.event}:${payment?.id ?? payload.id ?? crypto.randomUUID()}`,
      externalCustomerId,
      eventType,
      amountCents: payment ? Math.round(payment.value * 100) : null,
      status: payment?.status ?? payload.event,
      rawPayload: payload,
      newPeriodEnd: payment?.dueDate,
    };
  }
}

function mapAsaasEvent(asaasEvent: string): string {
  switch (asaasEvent) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return "payment_confirmed";
    case "PAYMENT_OVERDUE":
      return "payment_overdue";
    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_INACTIVATED":
      return "subscription_canceled";
    default:
      // Forwarded as-is: apply_billing_event() logs-and-ignores any
      // event_type it doesn't recognize, so new Asaas events never
      // break the handler — they just don't change subscription
      // state until this mapping is deliberately extended.
      return asaasEvent.toLowerCase();
  }
}
