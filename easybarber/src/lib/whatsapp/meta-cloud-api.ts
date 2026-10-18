import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { decryptToken } from "@/lib/whatsapp/token-crypto";
import { toWhatsAppDigits } from "@/lib/utils";
import type {
  SendMessageInput,
  SendMessageResult,
  WhatsAppProvider,
  WhatsAppTemplate,
} from "@/lib/whatsapp/types";

const TEMPLATE_LANGUAGE = "pt_BR";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

function graphApiVersion(): string {
  return process.env.META_GRAPH_API_VERSION || "v21.0";
}

interface CompanyCredentials {
  phoneNumberId: string;
  accessToken: string;
}

interface GraphApiErrorPayload {
  error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
}

interface GraphApiSendPayload {
  messages?: { id: string }[];
}

/**
 * Meta's official WhatsApp Cloud API
 * (https://developers.facebook.com/docs/whatsapp/cloud-api/overview) —
 * replaces Twilio (see docs/whatsapp-integration.md for the full
 * migration notes and template-approval steps). Unlike Twilio's single
 * platform-wide sender, each company connects its OWN WhatsApp
 * Business Account via Embedded Signup
 * (src/lib/actions/whatsapp-connection.ts), so this adapter is
 * instantiated PER COMPANY by createMetaCloudApiProvider() below,
 * which looks up and decrypts that one company's phone_number_id +
 * access token before any send — never a shared/global credential.
 *
 * Every message here is business-initiated (the recipient never
 * messaged first to open a 24h session), so only an approved message
 * Template can be sent, never free-form text — same WhatsApp Business
 * Platform rule Twilio's adapter already documented. The template NAME
 * sent to Meta is exactly the WhatsAppTemplate value
 * ("booking_confirmation" / "subscription_grace_reminder") — create
 * templates in Meta Business Manager with these exact names (see
 * docs/whatsapp-integration.md for the approved wording to submit).
 */
class MetaCloudApiProvider implements WhatsAppProvider {
  readonly name = "meta_cloud_api";

  constructor(private readonly credentials: CompanyCredentials | null) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by WhatsAppProvider; unlike Twilio's per-template Content SID, Meta's config is template-agnostic.
  isConfigured(_template: WhatsAppTemplate): boolean {
    return this.credentials !== null;
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    if (!this.credentials) {
      return { ok: false, error: "WhatsApp não está conectado para esta empresa." };
    }
    const { phoneNumberId, accessToken } = this.credentials;
    const url = `https://graph.facebook.com/${graphApiVersion()}/${phoneNumberId}/messages`;

    // Numbered placeholders ("1", "2", ...) map positionally onto the
    // template's body %parameters%, same convention the Twilio adapter
    // used for ContentVariables — callers don't need to change how
    // they build templateVariables.
    const parameters = Object.keys(input.templateVariables)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => ({ type: "text", text: input.templateVariables[key] }));

    const requestBody = JSON.stringify({
      messaging_product: "whatsapp",
      to: toWhatsAppDigits(input.to),
      type: "template",
      template: {
        name: input.template,
        language: { code: TEMPLATE_LANGUAGE },
        components: [{ type: "body", parameters }],
      },
    });

    let lastError = "Falha de rede ao enviar mensagem do WhatsApp.";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
          body: requestBody,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const payload = (await res.json().catch(() => null)) as GraphApiSendPayload | null;
          return { ok: true, providerMessageId: payload?.messages?.[0]?.id };
        }

        const errorPayload = (await res.json().catch(() => null)) as GraphApiErrorPayload | null;
        const message = errorPayload?.error?.message ?? `Meta Graph API error (${res.status})`;

        // Rate-limited (code 4/80007, or plain HTTP 429): the request
        // was rejected BEFORE processing, so — unlike any other
        // received response — retrying it is known-safe, not a
        // duplicate-send risk. Every other non-2xx response (a bad
        // phone number, an unapproved template, a 5xx) is trusted as
        // final: the request DID reach Meta and may have been
        // processed despite the error, so blindly retrying here is
        // exactly the scenario that could double-send.
        const isRateLimited = res.status === 429 || errorPayload?.error?.code === 4;
        if (isRateLimited && attempt < MAX_RETRIES) {
          const retryAfterHeader = res.headers.get("retry-after");
          const delayMs = retryAfterHeader
            ? Number(retryAfterHeader) * 1000
            : 500 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          lastError = message;
          continue;
        }

        return { ok: false, error: message };
      } catch (error) {
        clearTimeout(timeout);
        // No response was received at all (timeout/abort, DNS
        // failure, connection reset) — the request plausibly never
        // reached Meta's servers, making a retry safe here, unlike the
        // received-but-erroring case above.
        lastError =
          error instanceof Error
            ? error.message
            : "Unknown network error sending WhatsApp message.";
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        }
      }
    }

    return { ok: false, error: lastError };
  }
}

/**
 * Looks up and decrypts companyId's OWN WhatsApp connection (never a
 * shared credential — see whatsapp_connections in
 * 20260101000036_whatsapp_cloud_api_schema.sql). Returns a provider
 * that's simply "not configured" (never throws) when the company has
 * no connection yet, isn't fully connected, or its stored token fails
 * to decrypt — a caller must never fail its own main flow just
 * because WhatsApp isn't set up for that company (see
 * sendBookingConfirmation() in src/lib/actions/public-booking.ts and
 * notifyCompanyEnteringGracePeriod() in
 * src/lib/actions/subscription-notifications.ts).
 */
export async function createMetaCloudApiProvider(companyId: string): Promise<WhatsAppProvider> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("whatsapp_connections")
    .select("status, phone_number_id, access_token_encrypted")
    .eq("company_id", companyId)
    .maybeSingle();

  if (
    error ||
    !data ||
    data.status !== "connected" ||
    !data.phone_number_id ||
    !data.access_token_encrypted
  ) {
    return new MetaCloudApiProvider(null);
  }

  try {
    const accessToken = decryptToken(data.access_token_encrypted);
    return new MetaCloudApiProvider({ phoneNumberId: data.phone_number_id, accessToken });
  } catch (decryptError) {
    console.error(`Failed to decrypt WhatsApp access token for company ${companyId}:`, decryptError);
    return new MetaCloudApiProvider(null);
  }
}
