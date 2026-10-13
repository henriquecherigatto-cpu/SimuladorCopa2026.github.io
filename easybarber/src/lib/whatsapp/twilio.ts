import "server-only";
import { toWhatsAppDigits } from "@/lib/utils";
import type { SendMessageInput, SendMessageResult, WhatsAppProvider } from "@/lib/whatsapp/types";

/**
 * Twilio's WhatsApp messaging API
 * (https://www.twilio.com/docs/whatsapp/api) — picked as the default
 * adapter because it's the most accessible path for a first WhatsApp
 * integration: a free Sandbox mode lets you send real messages to a
 * handful of test numbers (each one joins once by WhatsApping a code
 * to the Sandbox number) with no business verification, before ever
 * registering a real WhatsApp Business number for production.
 *
 * Nothing here is wired to a live account yet: without
 * TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM /
 * TWILIO_CONTENT_SID configured, isConfigured() is false and
 * sendMessage() returns a clear { ok: false } instead of pretending to
 * succeed — the booking flow that calls this must never fail just
 * because WhatsApp sending isn't configured yet (see
 * sendBookingConfirmation() in src/lib/actions/public-booking.ts).
 *
 * A booking confirmation is business-initiated — the customer never
 * messaged first to open a 24h session — so WhatsApp only allows it
 * through a pre-approved message template, never free-form Body text
 * (confirmed the hard way: Twilio's API rejects a plain Body send for
 * this case with "ContentSid Required"). TWILIO_CONTENT_SID is that
 * template's id from Twilio's Content Template Builder; see
 * docs/whatsapp-integration.md for the exact template text to submit
 * and where to find the id once Meta approves it.
 */
export class TwilioWhatsAppProvider implements WhatsAppProvider {
  readonly name = "twilio";

  private get accountSid() {
    return process.env.TWILIO_ACCOUNT_SID;
  }

  private get authToken() {
    return process.env.TWILIO_AUTH_TOKEN;
  }

  /** e.g. "whatsapp:+14155238886" (Twilio's own Sandbox number) or a verified production WhatsApp sender. */
  private get fromAddress() {
    return process.env.TWILIO_WHATSAPP_FROM;
  }

  /** The approved Content Template's sid (starts "HX..."), from Twilio's Content Template Builder. */
  private get contentSid() {
    return process.env.TWILIO_CONTENT_SID;
  }

  isConfigured(): boolean {
    return !!this.accountSid && !!this.authToken && !!this.fromAddress && !!this.contentSid;
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    if (!this.accountSid || !this.authToken || !this.fromAddress || !this.contentSid) {
      return { ok: false, error: "Twilio WhatsApp provider is not configured." };
    }

    const body = new URLSearchParams({
      From: this.fromAddress,
      To: `whatsapp:+${toWhatsAppDigits(input.to)}`,
      ContentSid: this.contentSid,
      ContentVariables: JSON.stringify(input.templateVariables),
    });

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
          },
          body,
        },
      );

      const payload = (await res.json().catch(() => null)) as {
        sid?: string;
        message?: string;
      } | null;

      if (!res.ok) {
        return { ok: false, error: payload?.message ?? `Twilio API error (${res.status})` };
      }

      return { ok: true, providerMessageId: payload?.sid };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error sending WhatsApp message.",
      };
    }
  }
}
