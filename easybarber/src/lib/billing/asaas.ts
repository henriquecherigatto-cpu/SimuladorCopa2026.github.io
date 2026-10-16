import "server-only";
import { timingSafeEqual } from "node:crypto";
import { addMonths, format } from "date-fns";
import type {
  CheckoutSession,
  CreateCheckoutSessionInput,
  OpenInvoice,
  PaymentProvider,
  RawBillingEvent,
} from "@/lib/billing/types";

/**
 * Asaas (https://www.asaas.com) adapter — a Brazilian payment
 * provider, which fits the app's R$ pricing. Asaas itself also
 * supports boleto and card, but createCheckoutSession() below locks
 * every subscription to billingType: "PIX" — the platform owner's own
 * choice to offer only Pix for now, not a limitation of Asaas or this
 * adapter. Nothing here is wired to a live account yet: without
 * ASAAS_API_KEY configured, isConfigured() is false and
 * createCheckoutSession() throws a clear configuration error instead
 * of pretending to succeed. Flipping it on in production is then just
 * setting the three env vars below — no code changes.
 *
 * No payment data ever touches this server: createCheckoutSession()
 * creates an Asaas customer + subscription via their REST API, then
 * hands back the `invoiceUrl` of the first generated charge — a page
 * hosted on asaas.com showing the Pix QR code/copy-paste key. This
 * server never receives or stores any payment credential.
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

    // billingType: "PIX" — by the platform owner's choice, Pix is the
    // only payment method offered for now (boleto and card are
    // disabled, not just hidden: Asaas's hosted invoice page won't
    // offer them either). Asaas still hosts the actual QR
    // code/copy-paste key on its own invoice page — this server never
    // generates or sees it directly.
    const subscription = await this.request<{ id: string }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
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

    return {
      url: firstInvoice.invoiceUrl,
      externalCustomerId: customerId,
      externalSubscriptionId: subscription.id,
    };
  }

  async getOpenInvoice(externalSubscriptionId: string): Promise<OpenInvoice | null> {
    if (!this.isConfigured()) return null;

    // Filtered client-side rather than via an API-side status query
    // param: GET /v3/payments?subscription= is the one call shape this
    // adapter already relies on elsewhere (createCheckoutSession
    // above), so this reuses exactly that instead of a second,
    // unverified filter syntax.
    const payments = await this.request<{
      data: { invoiceUrl: string; dueDate: string; value: number; status: string }[];
    }>(`/payments?subscription=${externalSubscriptionId}`);

    const open = payments.data
      .filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    if (!open) return null;

    return {
      url: open.invoiceUrl,
      dueDate: open.dueDate,
      amountCents: Math.round(open.value * 100),
      overdue: open.status === "OVERDUE",
    };
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
      // payment.dueDate is the due date of the invoice that was JUST
      // paid (e.g. "today", for the first charge — see nextDueDate in
      // createCheckoutSession above) — the START of the period it
      // covers, not the next one. apply_billing_event() writes
      // newPeriodEnd straight into current_period_end ("paid through
      // this date"), so it must be shifted forward by one billing
      // cycle here. Every plan in this app is monthly (plans.period
      // has a check (period = 'mensal') constraint), matching the
      // cycle: "MONTHLY" set when the Asaas subscription was created.
      newPeriodEnd: payment?.dueDate
        ? format(addMonths(new Date(`${payment.dueDate}T00:00:00`), 1), "yyyy-MM-dd")
        : undefined,
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
