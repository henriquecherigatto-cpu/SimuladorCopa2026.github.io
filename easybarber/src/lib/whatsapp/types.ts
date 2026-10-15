/**
 * Shapes shared between a WhatsApp-provider adapter (e.g.
 * src/lib/whatsapp/twilio.ts) and the code that sends booking
 * confirmations (src/lib/actions/public-booking.ts). An adapter's job
 * is narrow and purely mechanical: speak the provider's HTTP API and
 * translate the result into these provider-agnostic shapes. It never
 * decides what message to send or when — that lives entirely in the
 * caller, so swapping providers later never touches that logic.
 */

/**
 * Every distinct business-initiated message this app sends, each
 * needing its OWN Meta-approved Content Template (approval is per
 * exact wording, not a blanket "this business can send templates").
 * Adding a new outbound message kind means adding a case here and a
 * matching TWILIO_CONTENT_SID_* env var — see
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
   * a Twilio quirk, so it belongs in the shared shape rather than
   * being Twilio-specific.
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

  /** False when the required API credentials — or this specific template's Content SID — aren't set (e.g. local/dev, or a template not yet approved). */
  isConfigured(template: WhatsAppTemplate): boolean;

  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
