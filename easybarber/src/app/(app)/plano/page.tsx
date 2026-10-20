import type { Metadata } from "next";
import { PlanoPageClient } from "@/components/plano/PlanoPageClient";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Plano e assinatura — Easy Barber" };

export default async function PlanoPage() {
  const { supabase, companyId, role } = await requireMembership();

  const [
    { data: subscription, error: subError },
    { data: plans, error: plansError },
    { data: billingEvents, error: billingError },
    { data: pixSettings, error: pixError },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "status, current_period_end, grace_period_ends_at, plan:plans ( id, name, price_cents, features )",
      )
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("plans")
      .select("id, name, price_cents, features, coming_soon")
      .eq("active", true)
      .order("price_cents", { ascending: true }),
    supabase
      .from("billing_events")
      .select("id, event_type, status, amount_cents, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20),
    // Single platform-wide row, readable by any authenticated user —
    // see pix_payment_settings_read in
    // 20260101000043_manual_pix_payment.sql.
    supabase.from("pix_payment_settings").select("pix_key, qr_code_url").eq("id", 1).maybeSingle(),
  ]);

  if (subError) throw subError;
  if (plansError) throw plansError;
  if (billingError) throw billingError;
  if (pixError) throw pixError;

  return (
    <PlanoPageClient
      companyId={companyId}
      subscription={subscription}
      plans={plans ?? []}
      billingEvents={billingEvents ?? []}
      canManage={role === "owner"}
      pixKey={pixSettings?.pix_key ?? null}
      qrCodeUrl={pixSettings?.qr_code_url ?? null}
    />
  );
}
