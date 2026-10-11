import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { AgendaViewSwitch } from "@/components/agenda/AgendaViewSwitch";
import { AgendaDayView } from "@/components/agenda/AgendaDayView";
import { Fab } from "@/components/ui/Fab";

export const metadata: Metadata = { title: "Agenda — Easy Barber" };

export default function AgendaDiaPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Agenda" action={<AgendaViewSwitch />} />
      <AgendaDayView />
      <Fab href="/agenda/novo" />
    </div>
  );
}
