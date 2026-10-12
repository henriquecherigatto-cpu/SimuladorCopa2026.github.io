import type { Metadata } from "next";
import { ServicosPageClient } from "@/components/servicos/ServicosPageClient";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Serviços — Easy Barber" };

export default async function ServicosPage() {
  const { supabase, companyId, role } = await requireMembership();

  const { data: services, error } = await supabase
    .from("services")
    .select(
      "id, name, description, duration_min, price_cents, active, professional_services ( professional:professionals ( id, name ) )",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <ServicosPageClient
      initialServices={services ?? []}
      canManage={role === "owner"}
    />
  );
}
