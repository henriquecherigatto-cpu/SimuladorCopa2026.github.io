import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PagamentoOnboardingClient } from "@/components/onboarding/PagamentoOnboardingClient";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pagamento — Easy Barber" };

export default async function OnboardingPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
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
  // A professional can't structurally exist yet for a still-pendente
  // company (see the comment in src/app/(app)/layout.tsx) — this is
  // just a safe fallback, not a path real usage takes.
  if (membership.role !== "owner") redirect("/dashboard");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, plan_id")
    .eq("company_id", membership.company_id)
    .maybeSingle();

  // Already paid — nothing to do here.
  if (!subscription || subscription.status !== "pendente") {
    redirect("/dashboard");
  }

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price_cents, features")
    .eq("active", true)
    .order("price_cents", { ascending: true });

  return (
    <PagamentoOnboardingClient
      companyId={membership.company_id}
      plans={plans ?? []}
      currentPlanId={subscription.plan_id}
      awaitingConfirmation={checkout === "pendente"}
    />
  );
}
