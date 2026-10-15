import "server-only";
import { toWhatsAppDigits } from "@/lib/utils";
import type {
  SendMessageInput,
  SendMessageResult,
  WhatsAppProvider,
  WhatsAppTemplate,
} from "@/lib/whatsapp/types";

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
 * TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM
 * configured, isConfigured() is false for every template, and
 * sendMessage() returns a clear { ok: false } instead of pretending to
 * succeed — a caller must never fail its own main flow just because
 * WhatsApp sending isn't configured yet (see sendBookingConfirmation()
 * in src/lib/actions/public-booking.ts and
 * notifyCompanyEnteringGracePeriod() in
 * src/lib/actions/subscription-notifications.ts).
 *
 * Every message here is business-initiated — the recipient never
 * messaged first to open a 24h session — so WhatsApp only allows it
 * through a pre-approved message template, never free-form Body text
 * (confirmed the hard way: Twilio's API rejects a plain Body send for
 * this case with "ContentSid Required"). Each WhatsAppTemplate has its
 * OWN Content SID env var (contentSidFor() below) because template
 * approval is per exact wording, not a blanket "this account can send
 * templates" — see docs/whatsapp-integration.md for the exact text to
 * submit for each one and where to find its id once Meta approves it.
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

  /**
   * Each outbound message kind (WhatsAppTemplate) has its own
   * Meta-approved Content Template, hence its own sid (starts "HX...")
   * from Twilio's Content Template Builder and its own env var —
   * approval is per exact wording, not per account.
   */
  private contentSidFor(template: WhatsAppTemplate): string | undefined {
    switch (template) {
      case "booking_confirmation":
        return process.env.TWILIO_CONTENT_SID;
      case "subscription_grace_reminder":
        return process.env.TWILIO_CONTENT_SID_GRACE_REMINDER;
    }
  }

  isConfigured(template: WhatsAppTemplate): boolean {
    return (
      !!this.accountSid && !!this.authToken && !!this.fromAddress && !!this.contentSidFor(template)
    );
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const contentSid = this.contentSidFor(input.template);
    if (!this.accountSid || !this.authToken || !this.fromAddress || !contentSid) {
      return {
        ok: false,
        error: `Twilio WhatsApp provider is not configured for template "${input.template}".`,
      };
    }

    const body = new URLSearchParams({
      From: this.fromAddress,
      To: `whatsapp:+${toWhatsAppDigits(input.to)}`,
      ContentSid: contentSid,
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
