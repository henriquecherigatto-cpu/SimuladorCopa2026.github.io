import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarPlus,
  CalendarDays,
  Scissors,
  Users,
  UserCog,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { AppointmentStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrencyBRL } from "@/lib/utils";
import { requireMembership } from "@/lib/supabase/current-user";

export const metadata: Metadata = { title: "Painel — Easy Barber" };

export default async function DashboardPage() {
  const { supabase, companyId, userId } = await requireMembership();

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const monthStart = `${todayStr.slice(0, 7)}-01`;

  const [
    { data: profile },
    { data: todaysAppointments },
    { count: activeProfessionalsCount },
    { count: activeServicesCount },
    { count: totalCustomersCount },
    { count: newCustomersCount },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, status, customer:customers!appointments_customer_id_fkey(name), service:services!appointments_service_id_fkey(name, price_cents), professional:professionals!appointments_professional_id_fkey(name, color)",
      )
      .eq("company_id", companyId)
      .gte("starts_at", `${todayStr}T00:00:00Z`)
      .lt("starts_at", `${todayStr}T23:59:59.999Z`)
      .order("starts_at", { ascending: true }),
    supabase
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("active", true),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("active", true),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", `${monthStart}T00:00:00Z`),
  ]);

  const appointments = todaysAppointments ?? [];
  const revenueToday = appointments
    .filter((a) => a.status !== "cancelado")
    .reduce((sum, a) => sum + (a.service?.price_cents ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Olá, ${profile?.full_name || "👋"}`}
        description={`Aqui está o resumo da sua barbearia em ${format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}.`}
        action={
          <Button href="/agenda/novo" icon={<CalendarPlus className="size-4" />}>
            Novo agendamento
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Agendamentos hoje"
          value={appointments.length}
          tone="orange"
        />
        <StatCard
          icon={Wallet}
          label="Receita prevista do dia"
          value={formatCurrencyBRL(revenueToday / 100)}
          tone="success"
        />
        <StatCard
          icon={Users}
          label="Clientes novos no mês"
          value={newCustomersCount ?? 0}
          tone="graphite"
        />
        <StatCard
          icon={UserCog}
          label="Profissionais ativos"
          value={activeProfessionalsCount ?? 0}
          tone="graphite"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/agenda/novo"
          className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-colors hover:border-brand-orange/40"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
            <CalendarPlus className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand-graphite">
              Novo agendamento
            </p>
            <p className="text-xs text-brand-graphite/50">Agende um cliente</p>
          </div>
        </Link>
        <Link
          href="/clientes"
          className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-colors hover:border-brand-orange/40"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
            <Users className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand-graphite">
              Clientes
            </p>
            <p className="text-xs text-brand-graphite/50">
              {totalCustomersCount ?? 0} cadastrados
            </p>
          </div>
        </Link>
        <Link
          href="/servicos"
          className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-colors hover:border-brand-orange/40"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
            <Scissors className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand-graphite">
              Serviços
            </p>
            <p className="text-xs text-brand-graphite/50">
              {activeServicesCount ?? 0} ativos
            </p>
          </div>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agendamentos de hoje</CardTitle>
          <Button href="/agenda" variant="ghost" size="sm" icon={<ArrowRight className="size-4" />}>
            Ver todos
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {appointments.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nenhum agendamento para hoje"
              description="Quando você criar um agendamento para hoje, ele aparecerá aqui."
              action={
                <Button href="/agenda/novo" size="sm">
                  Criar agendamento
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-black/5">
              {appointments.map((appt) => (
                <li key={appt.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="w-14 shrink-0 text-sm font-semibold text-brand-graphite">
                    {format(new Date(appt.starts_at), "HH:mm")}
                  </span>
                  {appt.professional && (
                    <Avatar
                      name={appt.professional.name}
                      color={appt.professional.color}
                      size="sm"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-graphite">
                      {appt.customer?.name}
                    </p>
                    <p className="truncate text-xs text-brand-graphite/50">
                      {appt.service?.name} · {appt.professional?.name}
                    </p>
                  </div>
                  <AppointmentStatusBadge status={appt.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
