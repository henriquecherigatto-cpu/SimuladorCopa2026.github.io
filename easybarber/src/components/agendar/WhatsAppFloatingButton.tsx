import { buildWhatsAppLink } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

export function WhatsAppFloatingButton({
  phone,
  companyName,
}: {
  phone: string;
  companyName: string;
}) {
  const href = buildWhatsAppLink(phone, `Olá! Vim pelo link de agendamento da ${companyName}.`);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a barbearia no WhatsApp"
      title="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-20 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
