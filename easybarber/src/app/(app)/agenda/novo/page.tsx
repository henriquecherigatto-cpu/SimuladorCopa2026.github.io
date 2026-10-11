import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { NewAppointmentForm } from "@/components/agenda/NewAppointmentForm";

export const metadata: Metadata = { title: "Novo agendamento — Easy Barber" };

export default function NovoAgendamentoPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Link
        href="/agenda"
        className="flex items-center gap-1.5 text-sm font-medium text-brand-graphite/60 hover:text-brand-graphite"
      >
        <ArrowLeft className="size-4" />
        Voltar para a agenda
      </Link>
      <PageHeader
        title="Novo agendamento"
        description="Preencha os dados para agendar um atendimento."
      />
      <Card>
        <CardContent>
          <NewAppointmentForm />
        </CardContent>
      </Card>
    </div>
  );
}
