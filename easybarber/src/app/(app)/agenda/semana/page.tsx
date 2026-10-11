import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { AgendaViewSwitch } from "@/components/agenda/AgendaViewSwitch";
import { AgendaWeekView } from "@/components/agenda/AgendaWeekView";
import { Fab } from "@/components/ui/Fab";

export const metadata: Metadata = { title: "Agenda semanal — Easy Barber" };

export default function AgendaSemanaPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Agenda" action={<AgendaViewSwitch />} />
      <AgendaWeekView />
      <Fab href="/agenda/novo" />
    </div>
  );
}
