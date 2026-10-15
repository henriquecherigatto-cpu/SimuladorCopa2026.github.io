"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

export function MarketingMobileNav({ whatsappHref }: { whatsappHref: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        className="flex size-10 items-center justify-center rounded-lg text-brand-graphite hover:bg-black/5"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-black/5 bg-white px-4 py-3 shadow-lg">
          <nav className="flex flex-col gap-1">
            <a
              href="#inicio"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-graphite hover:bg-black/5"
            >
              Início
            </a>
            <a
              href="#funcionalidades"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-graphite hover:bg-black/5"
            >
              Funcionalidades
            </a>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-brand-graphite hover:bg-black/5"
            >
              Entrar
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 rounded-full bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white"
            >
              <WhatsAppIcon className="size-4" />
              Falar no WhatsApp
            </a>
          </nav>
        </div>
      )}
    </div>
  );
}
