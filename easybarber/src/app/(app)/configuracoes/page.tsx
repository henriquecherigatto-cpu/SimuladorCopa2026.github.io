import type { Metadata } from "next";
import { ConfiguracoesPageClient } from "@/components/configuracoes/ConfiguracoesPageClient";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Configurações — Easy Barber" };

export default async function ConfiguracoesPage() {
  const { supabase, companyId, role } = await requireMembership();

  const [{ data: company, error }, { data: businessHours, error: hoursError }] =
    await Promise.all([
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
    ]);
  if (error) throw error;
  if (hoursError) throw hoursError;

  return (
    <ConfiguracoesPageClient
      company={company}
      businessHours={businessHours ?? []}
      canManage={role === "owner"}
    />
  );
}
