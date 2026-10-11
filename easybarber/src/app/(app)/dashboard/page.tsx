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
import { DemoBanner } from "@/components/ui/DemoBanner";
import {
  customers,
  demoUser,
  getAppointmentsByDate,
  getCustomerById,
  getProfessionalById,
  getServiceById,
  professionals,
  services,
  todayDate,
} from "@/lib/mock-data";
import { formatCurrencyBRL } from "@/lib/utils";

export const metadata: Metadata = { title: "Painel — Easy Barber" };

export default function DashboardPage() {
  const todayStr = format(todayDate, "yyyy-MM-dd");
  const todaysAppointments = getAppointmentsByDate(todayStr);
  const activeProfessionals = professionals.filter((p) => p.active);
  const newCustomersThisMonth = customers.filter((c) => {
    const createdMonth = c.createdAt.slice(0, 7);
    const nowMonth = todayStr.slice(0, 7);
    return createdMonth === nowMonth;
  }).length;
  const revenueToday = todaysAppointments
    .filter((a) => a.status !== "cancelado")
    .reduce((sum, a) => sum + (getServiceById(a.serviceId)?.price ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Olá, ${demoUser.name} 👋`}
        description={`Aqui está o resumo da sua barbearia em ${format(todayDate, "EEEE, d 'de' MMMM", { locale: ptBR })}.`}
        action={
          <Button href="/agenda/novo" icon={<CalendarPlus className="size-4" />}>
            Novo agendamento
          </Button>
        }
      />

      <DemoBanner />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Agendamentos hoje"
          value={todaysAppointments.length}
          tone="orange"
        />
        <StatCard
          icon={Wallet}
          label="Receita prevista do dia"
          value={formatCurrencyBRL(revenueToday)}
          tone="success"
        />
        <StatCard
          icon={Users}
          label="Clientes novos no mês"
          value={newCustomersThisMonth}
          tone="graphite"
        />
        <StatCard
          icon={UserCog}
          label="Profissionais ativos"
          value={activeProfessionals.length}
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
              {customers.length} cadastrados
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
              {services.filter((s) => s.active).length} ativos
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
          {todaysAppointments.length === 0 ? (
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
              {todaysAppointments.map((appt) => {
                const customer = getCustomerById(appt.customerId);
                const professional = getProfessionalById(appt.professionalId);
                const service = getServiceById(appt.serviceId);
                return (
                  <li
                    key={appt.id}
                    className="flex items-center gap-3 px-5 py-3.5"
                  >
                    <span className="w-14 shrink-0 text-sm font-semibold text-brand-graphite">
                      {appt.startTime}
                    </span>
                    {professional && (
                      <Avatar
                        name={professional.name}
                        color={professional.color}
                        size="sm"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-brand-graphite">
                        {customer?.name}
                      </p>
                      <p className="truncate text-xs text-brand-graphite/50">
                        {service?.name} · {professional?.name}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={appt.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
