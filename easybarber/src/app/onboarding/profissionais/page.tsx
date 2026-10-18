import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfissionaisOnboardingClient } from "@/components/onboarding/ProfissionaisOnboardingClient";
import { createClient } from "@/lib/supabase/server";
import { onboardingStepRoute } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Profissionais — Easy Barber" };

export default async function OnboardingProfissionaisPage() {
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

  const [{ data: subscription }, { data: company }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status")
      .eq("company_id", membership.company_id)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("onboarding_step")
      .eq("id", membership.company_id)
      .single(),
  ]);

  if (subscription?.status === "pendente") redirect("/onboarding/pagamento");
  if (company && company.onboarding_step !== 2) {
    redirect(onboardingStepRoute(company.onboarding_step));
  }

  const [{ data: professionals }, { data: services }] = await Promise.all([
    supabase
      .from("professionals")
      .select("id, name, phone, role_title")
      .eq("company_id", membership.company_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("services")
      .select("id")
      .eq("company_id", membership.company_id),
  ]);

  return (
    <ProfissionaisOnboardingClient
      initialProfessionals={professionals ?? []}
      existingServiceIds={(services ?? []).map((s) => s.id)}
    />
  );
}
