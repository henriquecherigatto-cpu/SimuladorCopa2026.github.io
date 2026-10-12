import "server-only";
import { TwilioWhatsAppProvider } from "@/lib/whatsapp/twilio";
import type { WhatsAppProvider } from "@/lib/whatsapp/types";

/**
 * The single place that picks which WhatsAppProvider implementation
 * is live. Swapping providers later (Meta's own Cloud API, another
 * BSP) means adding a new adapter implementing the WhatsAppProvider
 * interface from src/lib/whatsapp/types.ts and changing the one line
 * below — nothing in the booking flow needs to know which provider is
 * configured.
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  return new TwilioWhatsAppProvider();
}
