import type { Metadata } from "next";
import { ConfiguracoesPageClient } from "@/components/configuracoes/ConfiguracoesPageClient";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Configurações — Easy Barber" };

export default async function ConfiguracoesPage() {
  const { supabase, companyId, role } = await requireMembership();

  const { data: company, error } = await supabase
    .from("companies")
    .select("id, name, phone, whatsapp_number, address")
    .eq("id", companyId)
    .single();
  if (error) throw error;

  return <ConfiguracoesPageClient company={company} canManage={role === "owner"} />;
}
