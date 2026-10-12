import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBookingPage } from "@/lib/actions/public-booking";
import { PublicAgendarPageClient } from "@/components/agendar/PublicAgendarPageClient";

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

  return (
    <div className="flex min-h-dvh flex-col bg-brand-surface">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-1 px-4 py-6 sm:px-6">
          <h1 className="text-xl font-bold text-brand-graphite">{company.name}</h1>
          <p className="text-sm text-brand-graphite/60">
            {[company.address, company.phone].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:px-6">
        <PublicAgendarPageClient
          slug={slug}
          companyName={company.name}
          companyWhatsapp={company.whatsapp_number}
          companyAddress={company.address}
          services={services}
          professionals={professionals}
        />
      </main>

      <footer className="py-6 text-center text-xs text-brand-graphite/40">
        Agendamento via Easy Barber
      </footer>
    </div>
  );
}
