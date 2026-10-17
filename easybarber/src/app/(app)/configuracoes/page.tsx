import type { Metadata } from "next";
import { ConfiguracoesPageClient } from "@/components/configuracoes/ConfiguracoesPageClient";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Configurações — Easy Barber" };

export default async function ConfiguracoesPage() {
  const { supabase, companyId, role } = await requireMembership();

  const [
    { data: company, error },
    { data: businessHours, error: hoursError },
    { data: subscription },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, phone, whatsapp_number, address, cnpj")
      .eq("id", companyId)
      .single(),
    supabase
      .from("business_hours")
      .select("day_of_week, is_open, start_time, end_time")
      .eq("company_id", companyId)
      .order("day_of_week", { ascending: true }),
    // Owner-only read (subscriptions_select RLS) — purely informational
    // for the WhatsApp-confirmation note below. The actual send is
    // gated server-side regardless of anything this page shows — see
    // whatsapp_confirmation_allowed() in
    // supabase/migrations/20260101000034_whatsapp_confirmation_subscription_gate.sql.
    supabase
      .from("subscriptions")
      .select("status, plans ( whatsapp_confirmations_included )")
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);
  if (error) throw error;
  if (hoursError) throw hoursError;

  return (
    <ConfiguracoesPageClient
      company={company}
      businessHours={businessHours ?? []}
      canManage={role === "owner"}
      whatsappConfirmation={{
        planIncludesFeature: subscription?.plans?.whatsapp_confirmations_included ?? false,
        subscriptionActive: subscription?.status === "ativa",
      }}
    />
  );
}
