import type { Metadata } from "next";
import { PlanoPageClient } from "@/components/plano/PlanoPageClient";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Plano e assinatura — Easy Barber" };

export default async function PlanoPage() {
  const { supabase, companyId, role } = await requireMembership();

  const [{ data: subscription, error: subError }, { data: plans, error: plansError }, { data: billingEvents, error: billingError }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select(
          "status, current_period_end, grace_period_ends_at, plan:plans ( id, name, price_cents, features )",
        )
        .eq("company_id", companyId)
        .single(),
      supabase
        .from("plans")
        .select("id, name, price_cents, features")
        .eq("active", true)
        .order("price_cents", { ascending: true }),
      supabase
        .from("billing_events")
        .select("id, event_type, status, amount_cents, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (subError) throw subError;
  if (plansError) throw plansError;
  if (billingError) throw billingError;

  return (
    <PlanoPageClient
      subscription={subscription}
      plans={plans ?? []}
      billingEvents={billingEvents ?? []}
      canManage={role === "owner"}
    />
  );
}
