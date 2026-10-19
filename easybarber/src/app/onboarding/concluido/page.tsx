import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreditCard, PartyPopper } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { BookingLinkCard } from "@/components/dashboard/BookingLinkCard";
import { createClient } from "@/lib/supabase/server";
import { onboardingStepRoute } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Tudo pronto! — Easy Barber" };

export default async function OnboardingConcluidoPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: membership } = await supabase
    .from("company_members")
    .select("role, company_id")
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding/empresa");
  if (membership.role !== "owner") redirect("/dashboard");

  const [{ data: company }, { data: subscription }] = await Promise.all([
    supabase
      .from("companies")
      .select("onboarding_step, slug")
      .eq("id", membership.company_id)
      .single(),
    supabase
      .from("subscriptions")
      .select("status")
      .eq("company_id", membership.company_id)
      .maybeSingle(),
  ]);

  // Reachable only once truly done — bounce back into the wizard at
  // the right step if this is visited before onboarding_step reaches 3.
  if (company && company.onboarding_step !== 3) {
    redirect(onboardingStepRoute(company.onboarding_step));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const bookingLink = company?.slug ? `${appUrl}/agendar/${company.slug}` : "";
  // The usual case: payment was never part of this sequence, so a
  // freshly-onboarded company is still 'pendente' here — the booking
  // link exists but won't actually take a real appointment yet (see
  // 20260101000041_pendente_blocks_bookings.sql), so the primary CTA
  // is activating the subscription, not sharing the link.
  const stillPendente = subscription?.status === "pendente";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-surface px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="text-sm text-brand-graphite/60">
            Sua barbearia está configurada.
          </p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
          <div className="mb-5 flex flex-col items-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-success/10 text-brand-success">
              <PartyPopper className="size-6" />
            </span>
            <h1 className="text-lg font-bold text-brand-graphite">
              {stillPendente ? "Falta só um passo!" : "Tudo pronto!"}
            </h1>
            <p className="text-sm text-brand-graphite/60">
              {stillPendente
                ? "Guarde o link de agendamento abaixo — ative a assinatura para liberar os agendamentos, tanto os seus quanto os dos seus clientes, antes de divulgar."
                : "Compartilhe o link abaixo nas redes sociais e no WhatsApp para que seus clientes comecem a agendar horários."}
            </p>
          </div>

          {bookingLink && <BookingLinkCard url={bookingLink} />}

          {stillPendente ? (
            <div className="mt-5 flex flex-col gap-2">
              <Button href="/plano" fullWidth icon={<CreditCard className="size-4" />}>
                Ativar assinatura
              </Button>
              <Button href="/dashboard" variant="ghost" fullWidth>
                Ir para o painel agora
              </Button>
            </div>
          ) : (
            <Button href="/dashboard" fullWidth className="mt-5">
              Começar a usar o Easy Barber
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
