/**
 * Shapes shared between a WhatsApp-provider adapter (e.g.
 * src/lib/whatsapp/twilio.ts) and the code that sends booking
 * confirmations (src/lib/actions/public-booking.ts). An adapter's job
 * is narrow and purely mechanical: speak the provider's HTTP API and
 * translate the result into these provider-agnostic shapes. It never
 * decides what message to send or when — that lives entirely in the
 * caller, so swapping providers later never touches that logic.
 */

export interface SendMessageInput {
  /** Visitor-typed phone number, any reasonable format — the adapter normalizes it. */
  to: string;
  body: string;
}

export interface SendMessageResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  readonly name: string;

  /** False when the required API credentials aren't set (e.g. local/dev). */
  isConfigured(): boolean;

  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
