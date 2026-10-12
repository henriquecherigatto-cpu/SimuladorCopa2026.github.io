import type { Metadata } from "next";
import { ProfissionaisPageClient } from "@/components/profissionais/ProfissionaisPageClient";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Profissionais — Easy Barber" };

export default async function ProfissionaisPage() {
  const { supabase, companyId, role } = await requireMembership();

  const [{ data: professionals, error: profError }, { data: services, error: svcError }] =
    await Promise.all([
      supabase
        .from("professionals")
        .select(
          "id, name, phone, role_title, color, photo_url, work_start, work_end, weekly_days_off, professional_services ( service:services ( id, name ) ), professional_breaks:professional_breaks!professional_breaks_professional_id_fkey ( id, start_time, end_time, label ), appointments:appointments!appointments_professional_id_fkey ( count )",
        )
        .eq("company_id", companyId)
        .eq("active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("name"),
    ]);

  if (profError) throw profError;
  if (svcError) throw svcError;

  return (
    <ProfissionaisPageClient
      initialProfessionals={professionals ?? []}
      allServices={services ?? []}
      canManage={role === "owner"}
    />
  );
}
