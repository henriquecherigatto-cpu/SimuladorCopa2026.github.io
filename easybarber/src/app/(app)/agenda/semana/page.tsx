import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { AgendaViewSwitch } from "@/components/agenda/AgendaViewSwitch";
import { AgendaWeekView } from "@/components/agenda/AgendaWeekView";
import { Fab } from "@/components/ui/Fab";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Agenda semanal — Easy Barber" };

export default async function AgendaSemanaPage() {
  const { supabase, companyId } = await requireMembership();

  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, name, color, photo_url")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("name");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Agenda" action={<AgendaViewSwitch />} />
      <AgendaWeekView professionals={professionals ?? []} />
      <Fab href="/agenda/novo" />
    </div>
  );
}
