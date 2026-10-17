import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { AgendaDayView } from "@/components/agenda/AgendaDayView";
import { TimeBlockManager } from "@/components/agenda/TimeBlockManager";
import { Fab } from "@/components/ui/Fab";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Agenda — Easy Barber" };

export default async function AgendaPage() {
  const { supabase, companyId, role } = await requireMembership();

  const [{ data: professionals }, { data: businessHours }] = await Promise.all([
    supabase
      .from("professionals")
      .select("id, name, color, photo_url")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("business_hours")
      .select("day_of_week, is_open, start_time, end_time")
      .eq("company_id", companyId),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Agenda"
        action={role === "owner" && <TimeBlockManager professionals={professionals ?? []} />}
      />
      <AgendaDayView
        professionals={professionals ?? []}
        businessHours={businessHours ?? []}
      />
      <Fab href="/agenda/novo" />
    </div>
  );
}
