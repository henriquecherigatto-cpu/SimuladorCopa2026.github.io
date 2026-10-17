import type { Metadata } from "next";
import { ConfiguracoesPageClient } from "@/components/configuracoes/ConfiguracoesPageClient";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Configurações — Easy Barber" };

export default async function ConfiguracoesPage() {
  const { supabase, companyId, role } = await requireMembership();

  const isOwner = role === "owner";

  const [
    { data: company, error },
    { data: businessHours, error: hoursError },
    { data: subscription },
    connectionResult,
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
    // get_whatsapp_connection_status() is itself owner-or-admin-only
    // (never the encrypted token either way — see
    // 20260101000036_whatsapp_cloud_api_schema.sql) — skip the doomed
    // call for a professional rather than let it fail and show a
    // misleading "disconnected" fallback.
    isOwner
      ? supabase.rpc("get_whatsapp_connection_status", { p_company_id: companyId })
      : Promise.resolve({ data: null }),
  ]);
  if (error) throw error;
  if (hoursError) throw hoursError;

  const connectionRow = connectionResult.data?.[0];

  return (
    <ConfiguracoesPageClient
      company={company}
      businessHours={businessHours ?? []}
      canManage={role === "owner"}
      whatsappConfirmation={{
        planIncludesFeature: subscription?.plans?.whatsapp_confirmations_included ?? false,
        subscriptionActive: subscription?.status === "ativa",
      }}
      whatsappConnection={{
        status: connectionRow?.status ?? "disconnected",
        displayPhoneNumber: connectionRow?.display_phone_number ?? null,
        connectedAt: connectionRow?.connected_at ?? null,
        lastError: connectionRow?.last_error ?? null,
      }}
    />
  );
}
