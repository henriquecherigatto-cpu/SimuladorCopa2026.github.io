import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartyPopper } from "lucide-react";
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

  const { data: company } = await supabase
    .from("companies")
    .select("onboarding_step, slug")
    .eq("id", membership.company_id)
    .single();

  // Reachable only once truly done — bounce back into the wizard at
  // the right step if this is visited before onboarding_step reaches 3.
  if (company && company.onboarding_step !== 3) {
    redirect(onboardingStepRoute(company.onboarding_step));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const bookingLink = company?.slug ? `${appUrl}/agendar/${company.slug}` : "";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-surface px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="text-sm text-brand-graphite/60">
            Sua barbearia está pronta para receber agendamentos.
          </p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
          <div className="mb-5 flex flex-col items-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-success/10 text-brand-success">
              <PartyPopper className="size-6" />
            </span>
            <h1 className="text-lg font-bold text-brand-graphite">Tudo pronto!</h1>
            <p className="text-sm text-brand-graphite/60">
              Compartilhe o link abaixo nas redes sociais e no WhatsApp para
              que seus clientes comecem a agendar horários.
            </p>
          </div>

          {bookingLink && <BookingLinkCard url={bookingLink} />}

          <Button href="/dashboard" fullWidth className="mt-5">
            Começar a usar o Easy Barber
          </Button>
        </div>
      </div>
    </div>
  );
}
