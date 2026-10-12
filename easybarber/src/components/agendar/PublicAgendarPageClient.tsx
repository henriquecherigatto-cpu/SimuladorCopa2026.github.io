"use client";

import * as React from "react";
import { CalendarSearch, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicBookingForm } from "@/components/agendar/PublicBookingForm";
import { PublicLookupForm } from "@/components/agendar/PublicLookupForm";
import { WhatsAppFloatingButton } from "@/components/agendar/WhatsAppFloatingButton";
import type { PublicProfessional, PublicService } from "@/lib/actions/public-booking";

type Tab = "agendar" | "consultar";

export function PublicAgendarPageClient({
  slug,
  companyName,
  companyWhatsapp,
  companyAddress,
  services,
  professionals,
}: {
  slug: string;
  companyName: string;
  companyWhatsapp: string;
  companyAddress: string | null;
  services: PublicService[];
  professionals: PublicProfessional[];
}) {
  const [tab, setTab] = React.useState<Tab>("agendar");

  return (
    <>
      <div className="mb-5 flex gap-1.5 rounded-xl bg-black/5 p-1">
        <button
          type="button"
          onClick={() => setTab("agendar")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            tab === "agendar"
              ? "bg-white text-brand-graphite shadow-sm"
              : "text-brand-graphite/60 hover:text-brand-graphite",
          )}
        >
          <CalendarPlus className="size-4" />
          Agendar
        </button>
        <button
          type="button"
          onClick={() => setTab("consultar")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            tab === "consultar"
              ? "bg-white text-brand-graphite shadow-sm"
              : "text-brand-graphite/60 hover:text-brand-graphite",
          )}
        >
          <CalendarSearch className="size-4" />
          Consultar meu agendamento
        </button>
      </div>

      {tab === "agendar" ? (
        <PublicBookingForm
          slug={slug}
          companyName={companyName}
          companyAddress={companyAddress}
          services={services}
          professionals={professionals}
        />
      ) : (
        <PublicLookupForm slug={slug} />
      )}

      {companyWhatsapp && (
        <WhatsAppFloatingButton phone={companyWhatsapp} companyName={companyName} />
      )}
    </>
  );
}
