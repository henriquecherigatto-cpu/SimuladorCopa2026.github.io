import { buildWhatsAppLink } from "@/lib/utils";

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
      <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.43 1.32 4.92L2 22l5.29-1.39c1.43.78 3.04 1.2 4.69 1.2h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01C17.18 3.03 14.69 2 12.04 2zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.12.82.83-3.04-.2-.32a8.18 8.18 0 0 1-1.25-4.38c0-4.54 3.7-8.23 8.22-8.23zm-4.52 4.2c-.17 0-.45.06-.69.32-.24.26-.9.88-.9 2.15s.92 2.5 1.05 2.67c.13.17 1.8 2.86 4.44 3.9 2.2.87 2.64.7 3.12.65.48-.05 1.55-.63 1.77-1.24.22-.6.22-1.12.15-1.23-.07-.1-.24-.17-.5-.3-.26-.13-1.55-.77-1.79-.86-.24-.09-.42-.13-.6.13-.17.26-.68.86-.84 1.04-.15.17-.3.19-.56.07-.26-.13-1.1-.4-2.1-1.3-.78-.69-1.3-1.55-1.46-1.81-.15-.26-.02-.4.11-.53.11-.11.26-.3.39-.44.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.07-.13-.6-1.45-.82-1.98-.22-.52-.44-.45-.6-.46h-.5z" />
      </svg>
    </a>
  );
}
