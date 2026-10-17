/**
 * Shapes shared between a WhatsApp-provider adapter (currently
 * src/lib/whatsapp/meta-cloud-api.ts, the only implementation) and the
 * code that sends booking confirmations
 * (src/lib/actions/public-booking.ts). An adapter's job is narrow and
 * purely mechanical: speak the provider's HTTP API and translate the
 * result into these provider-agnostic shapes. It never decides what
 * message to send or when — that lives entirely in the caller, so
 * swapping providers later never touches that logic.
 */

/**
 * Every distinct business-initiated message this app sends, each
 * needing its OWN Meta-approved message template (approval is per
 * exact wording, not a blanket "this business can send templates").
 * The template NAME sent to Meta is exactly this value — adding a new
 * outbound message kind means adding a case here and creating a
 * matching template in Meta Business Manager — see
 * docs/whatsapp-integration.md.
 */
export type WhatsAppTemplate = "booking_confirmation" | "subscription_grace_reminder";

export interface SendMessageInput {
  /** Visitor-typed phone number, any reasonable format — the adapter normalizes it. */
  to: string;
  template: WhatsAppTemplate;
  /**
   * Numbered placeholders ("1", "2", ...) for the template above. A
   * business-initiated WhatsApp message (one the recipient didn't
   * message first to open a 24h session) can only use free-form text
   * from inside that window — any provider sending a proactive
   * message like a booking confirmation must fill in an approved
   * template instead. This is a WhatsApp Business Platform rule, not
   * specific to any one provider, so it belongs in the shared shape.
   */
  templateVariables: Record<string, string>;
}

export interface SendMessageResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  readonly name: string;

  /** False when the required API credentials aren't set (e.g. no company connection yet) or this specific template isn't usable (e.g. not yet approved). */
  isConfigured(template: WhatsAppTemplate): boolean;

  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
