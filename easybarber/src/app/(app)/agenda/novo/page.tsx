import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { NewAppointmentForm } from "@/components/agenda/NewAppointmentForm";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Novo agendamento — Easy Barber" };

export default async function NovoAgendamentoPage() {
  const { supabase, companyId } = await requireMembership();

  const [{ data: services }, { data: professionals }, { data: customers }] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, name, duration_min, price_cents, active")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("professionals")
        .select("id, name, active, professional_services ( service_id )")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("customers")
        .select("id, name, phone")
        .eq("company_id", companyId)
        .order("name"),
    ]);

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
          <NewAppointmentForm
            services={services ?? []}
            professionals={professionals ?? []}
            customers={customers ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
