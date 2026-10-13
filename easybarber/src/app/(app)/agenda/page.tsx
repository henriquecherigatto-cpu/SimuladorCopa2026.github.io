import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { AgendaViewSwitch } from "@/components/agenda/AgendaViewSwitch";
import { AgendaWeekView } from "@/components/agenda/AgendaWeekView";
import { TimeBlockManager } from "@/components/agenda/TimeBlockManager";
import { Fab } from "@/components/ui/Fab";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Agenda — Easy Barber" };

// The week view is the default landing view for "Agenda" (the day view
// lives at /agenda/dia) — a owner opening the Agenda wants the week's
// shape at a glance more often than a single day's minute-by-minute
// grid.
export default async function AgendaSemanaPage() {
  const { supabase, companyId, role } = await requireMembership();

  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, name, color, photo_url")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("name");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Agenda"
        action={
          <div className="flex items-center gap-2">
            {role === "owner" && <TimeBlockManager />}
            <AgendaViewSwitch />
          </div>
        }
      />
      <AgendaWeekView professionals={professionals ?? []} />
      <Fab href="/agenda/novo" />
    </div>
  );
}
