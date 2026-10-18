/**
 * Hard kill switch for WhatsApp sending — independent of plan,
 * subscription status, or whether a company has already connected an
 * account. Off while the platform's own Meta Business verification
 * (which needs a CNPJ the company doesn't have yet) is pending — see
 * docs/whatsapp-integration.md. The Meta Cloud API integration itself
 * is fully built and tested; flip this to `true` once the business
 * verification clears and real Meta credentials are set in
 * production. A plain function (not an env var): this is a business
 * decision with its own timeline, not an infrastructure setting.
 *
 * No "server-only" import — this is a pure constant, safe to read
 * from both server code (the actual send guard) and the Configurações
 * client component (to show "Em breve" instead of a working connect
 * button).
 */
export function isWhatsAppSendingEnabled(): boolean {
  return false;
}
