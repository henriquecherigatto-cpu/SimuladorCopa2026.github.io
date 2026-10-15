import { buildWhatsAppLink } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

// Platform support line (the site owner), not a per-company field —
// every barbershop owner using the app talks to the same number.
// Exported because the public marketing page (src/app/page.tsx) links
// to the same number from its header CTA.
export const SUPPORT_WHATSAPP_NUMBER = "5519989324020";

export function SupportWhatsAppButton() {
  const href = buildWhatsAppLink(
    SUPPORT_WHATSAPP_NUMBER,
    "Olá! Preciso de suporte com o Easy Barber.",
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com o suporte no WhatsApp"
      title="Suporte no WhatsApp"
      className="fixed bottom-24 right-4 z-20 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 lg:bottom-5 lg:right-5"
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
