import "server-only";
import { createMetaCloudApiProvider } from "@/lib/whatsapp/meta-cloud-api";
import type { WhatsAppProvider } from "@/lib/whatsapp/types";

/**
 * The single place that picks which WhatsAppProvider implementation is
 * live, and (since the Meta Cloud API migration) which COMPANY's own
 * credentials it's bound to — unlike Twilio's one-shared-sender design,
 * each company connects its own WhatsApp Business Account, so there is
 * no single "the" provider anymore, only "company X's provider".
 * Swapping providers again later means adding a new adapter
 * implementing WhatsAppProvider (src/lib/whatsapp/types.ts) and
 * changing the one line below — nothing in the booking/notification
 * flows needs to know which provider is configured.
 */
export async function getWhatsAppProvider(companyId: string): Promise<WhatsAppProvider> {
  return createMetaCloudApiProvider(companyId);
}
