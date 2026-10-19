import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, MapPin } from "lucide-react";
import { getPublicBookingPage } from "@/lib/actions/public-booking";
import { PublicAgendarPageClient } from "@/components/agendar/PublicAgendarPageClient";

// Matches the data-layer block in
// 20260101000041_pendente_blocks_bookings.sql — a company in either
// state can't actually have a new appointment created, so there's no
// point showing the booking form at all; this is checked again here
// purely for a clearer message than letting the customer fill out the
// whole form and hit create_public_appointment()'s rejection at
// submit time.
const NOT_ACCEPTING_STATUSES = new Set(["pendente", "suspensa"]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicBookingPage(slug);
  const name = result.ok ? result.data.company?.name : null;
  return {
    title: name ? `Agendar horário — ${name}` : "Agendar horário",
  };
}

export default async function AgendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublicBookingPage(slug);

  if (!result.ok || !result.data.company) {
    notFound();
  }

  const { company, services, professionals } = result.data;
  const acceptingBookings = !NOT_ACCEPTING_STATUSES.has(company.subscription_status ?? "pendente");

  return (
    <div className="flex min-h-dvh flex-col bg-brand-surface">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-1 px-4 py-6 sm:px-6">
          <h1 className="text-xl font-bold text-brand-graphite">{company.name}</h1>
          <p className="text-sm text-brand-graphite/60">
            {[company.address, company.phone].filter(Boolean).join(" · ")}
          </p>
          {company.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${company.name}, ${company.address}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-orange hover:underline"
            >
              <MapPin className="size-4" />
              Como chegar
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:px-6">
        {acceptingBookings ? (
          <PublicAgendarPageClient
            slug={slug}
            companyName={company.name}
            companyWhatsapp={company.whatsapp_number}
            companyAddress={company.address}
            services={services}
            professionals={professionals}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
              <CalendarClock className="size-6" />
            </span>
            <h2 className="text-base font-semibold text-brand-graphite">
              Agendamento indisponível no momento
            </h2>
            <p className="text-sm text-brand-graphite/60">
              {company.name} ainda não está aceitando agendamentos online.
              Entre em contato diretamente pelo telefone{" "}
              <strong>{company.phone}</strong> para marcar um horário.
            </p>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-brand-graphite/40">
        Agendamento via Easy Barber
      </footer>
    </div>
  );
}
