import "server-only";
import { AsaasProvider } from "@/lib/billing/asaas";
import type { PaymentProvider } from "@/lib/billing/types";

/**
 * The single place that picks which PaymentProvider implementation is
 * live. Swapping payment providers later means adding a new adapter
 * (implementing the PaymentProvider interface from
 * src/lib/billing/types.ts) and changing the one line below — nothing
 * in the webhook route, the sweep route, the checkout Server Action,
 * or the database state machine needs to know which provider is
 * configured.
 */
export function getPaymentProvider(): PaymentProvider {
  return new AsaasProvider();
}
