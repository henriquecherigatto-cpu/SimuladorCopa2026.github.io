import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { MarketingMobileNav } from "@/components/marketing/MarketingMobileNav";
import { buildWhatsAppLink } from "@/lib/utils";
import { SUPPORT_WHATSAPP_NUMBER } from "@/components/layout/SupportWhatsAppButton";

export function MarketingHeader() {
  const whatsappHref = buildWhatsAppLink(
    SUPPORT_WHATSAPP_NUMBER,
    "Olá! Quero saber mais sobre o Easy Barber.",
  );

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="relative mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#inicio">
          <Logo />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#inicio"
            className="text-sm font-medium text-brand-graphite/70 transition-colors hover:text-brand-graphite"
          >
            Início
          </a>
          <a
            href="#funcionalidades"
            className="text-sm font-medium text-brand-graphite/70 transition-colors hover:text-brand-graphite"
          >
            Funcionalidades
          </a>
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-brand-graphite/70 transition-colors hover:text-brand-graphite"
          >
            Entrar
          </Link>
          <Button
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="gap-2 rounded-full"
            icon={<WhatsAppIcon className="size-4" />}
          >
            Falar no WhatsApp
          </Button>
        </div>

        <MarketingMobileNav whatsappHref={whatsappHref} />
      </div>
    </header>
  );
}
