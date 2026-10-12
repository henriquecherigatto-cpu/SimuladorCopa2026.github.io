import type { Metadata } from "next";
import { ClientesPageClient } from "@/components/clientes/ClientesPageClient";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Clientes — Easy Barber" };

export default async function ClientesPage() {
  const { supabase, companyId } = await requireMembership();

  const { data: customers, error } = await supabase
    .from("customers")
    .select(
      "id, name, phone, email, notes, created_at, appointments:appointments!appointments_customer_id_fkey ( count )",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return <ClientesPageClient initialCustomers={customers ?? []} />;
}
