import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ServicosOnboardingClient } from "@/components/onboarding/ServicosOnboardingClient";
import { createClient } from "@/lib/supabase/server";
import { onboardingStepRoute } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Serviços — Easy Barber" };

export default async function OnboardingServicosPage() {
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
    .select("onboarding_step")
    .eq("id", membership.company_id)
    .single();

  if (company && company.onboarding_step !== 1) {
    redirect(onboardingStepRoute(company.onboarding_step));
  }

  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_min, price_cents")
    .eq("company_id", membership.company_id)
    .order("created_at", { ascending: true });

  return <ServicosOnboardingClient initialServices={services ?? []} />;
}
