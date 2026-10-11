"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Ban,
  Building2,
  CheckCircle2,
  Pencil,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import {
  SubscriptionStatusBadge,
} from "@/components/ui/StatusBadge";
import {
  adminCompanies as initialCompanies,
  plans as initialPlans,
  todayDate,
  type AdminCompanyRow,
  type SubscriptionStatusLabel,
} from "@/lib/mock-data";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import type { Plan } from "@/types";

interface AuditEntry {
  id: string;
  timestamp: Date;
  description: string;
}

const initialAuditLog: AuditEntry[] = [
  {
    id: "seed-1",
    timestamp: new Date(todayDate.getTime() - 1000 * 60 * 42),
    description: "Plano Profissional atualizado por Equipe Easy Barber",
  },
];

export function AdminPageClient() {
  const [companies, setCompanies] = React.useState<AdminCompanyRow[]>(
    initialCompanies,
  );
  const [plans, setPlans] = React.useState<Plan[]>(initialPlans);
  const [query, setQuery] = React.useState("");
  const [editingPlan, setEditingPlan] = React.useState<Plan | null>(null);
  const [auditLog, setAuditLog] = React.useState<AuditEntry[]>(initialAuditLog);

  const logAction = (description: string) => {
    setAuditLog((prev) => [
      { id: `log-${Date.now()}`, timestamp: new Date(), description },
      ...prev,
    ].slice(0, 20));
  };

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

  const metrics = {
    total: companies.length,
    active: companies.filter((c) => c.status === "Ativo").length,
    mrr: companies.reduce((sum, c) => {
      const plan = plans.find((p) => p.name === c.planName);
      return sum + (plan?.price ?? 0);
    }, 0),
    atRisk: companies.filter(
      (c) => c.status === "Pendente" || c.status === "Em tolerância",
    ).length,
  };

  const toggleCompanyStatus = (id: string) => {
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const nextStatus: SubscriptionStatusLabel =
          c.status === "Suspenso" ? "Ativo" : "Suspenso";
        logAction(
          `${nextStatus === "Suspenso" ? "Suspendeu" : "Reativou"} o acesso de ${c.name}`,
        );
        return { ...c, status: nextStatus };
      }),
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-start gap-3 rounded-2xl border border-brand-graphite/10 bg-brand-graphite px-4 py-3 text-white">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-brand-orange" />
        <div>
          <p className="text-sm font-semibold">Área restrita da plataforma</p>
          <p className="text-xs text-white/60">
            Visível apenas para administradores do Easy Barber — não para
            proprietários de barbearias.
          </p>
        </div>
      </div>

      <PageHeader
        title="Administração"
        description="Visão geral de todas as barbearias na plataforma."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Building2} label="Empresas cadastradas" value={metrics.total} tone="graphite" />
        <StatCard icon={CheckCircle2} label="Empresas ativas" value={metrics.active} tone="success" />
        <StatCard icon={TrendingUp} label="MRR estimado" value={formatCurrencyBRL(metrics.mrr)} tone="orange" />
        <StatCard icon={Ban} label="Em risco de suspensão" value={metrics.atRisk} tone="graphite" />
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Empresas</CardTitle>
          <div className="relative w-full max-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-graphite/40" />
            <input
              type="text"
              placeholder="Buscar empresa..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 text-sm text-brand-graphite outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-brand-graphite/40">
                  <th className="px-5 py-3 font-medium">Empresa</th>
                  <th className="px-5 py-3 font-medium">Plano</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Profissionais</th>
                  <th className="px-5 py-3 font-medium">Clientes</th>
                  <th className="px-5 py-3 font-medium">Próx. pagamento</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3.5 font-medium text-brand-graphite">
                      {c.name}
                    </td>
                    <td className="px-5 py-3.5 text-brand-graphite/70">
                      {c.planName}
                    </td>
                    <td className="px-5 py-3.5">
                      <SubscriptionStatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3.5 text-brand-graphite/70">
                      {c.professionals}
                    </td>
                    <td className="px-5 py-3.5 text-brand-graphite/70">
                      {c.customers}
                    </td>
                    <td className="px-5 py-3.5 text-brand-graphite/70">
                      {format(new Date(`${c.nextPayment}T00:00:00`), "dd/MM/yyyy")}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant={c.status === "Suspenso" ? "secondary" : "danger"}
                        onClick={() => toggleCompanyStatus(c.id)}
                      >
                        {c.status === "Suspenso" ? "Reativar" : "Suspender"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-brand-graphite/50">
                      Nenhuma empresa encontrada para &ldquo;{query}&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gestão de planos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 p-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-brand-surface"
              >
                <div>
                  <p className="text-sm font-medium text-brand-graphite">
                    {plan.name}
                  </p>
                  <p className="text-xs text-brand-graphite/50">
                    {formatCurrencyBRL(plan.price)}/mês ·{" "}
                    {plan.limits.maxProfessionals
                      ? `até ${plan.limits.maxProfessionals} profissionais`
                      : "profissionais ilimitados"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Pencil className="size-3.5" />}
                  onClick={() => setEditingPlan(plan)}
                >
                  Editar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registro de ações administrativas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="scrollbar-thin max-h-72 divide-y divide-black/5 overflow-y-auto">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                  <Users className="mt-0.5 size-4 shrink-0 text-brand-graphite/30" />
                  <div className="min-w-0">
                    <p className="text-sm text-brand-graphite">{entry.description}</p>
                    <p className="text-xs text-brand-graphite/40">
                      {format(entry.timestamp, "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <EditPlanModal
        plan={editingPlan}
        onClose={() => setEditingPlan(null)}
        onSave={(next) => {
          setPlans((prev) => prev.map((p) => (p.id === next.id ? next : p)));
          logAction(`Plano ${next.name} atualizado por Equipe Easy Barber`);
          setEditingPlan(null);
        }}
      />
    </div>
  );
}

function EditPlanModal({
  plan,
  onClose,
  onSave,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSave: (plan: Plan) => void;
}) {
  return (
    <Modal open={!!plan} onClose={onClose} title={plan ? `Editar ${plan.name}` : ""}>
      {plan && <EditPlanFormFields plan={plan} onSave={onSave} />}
    </Modal>
  );
}

function EditPlanFormFields({
  plan,
  onSave,
}: {
  plan: Plan;
  onSave: (plan: Plan) => void;
}) {
  const [price, setPrice] = React.useState(plan.price.toString());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = Number(price.replace(",", "."));
        if (!value || value <= 0) return;
        onSave({ ...plan, price: value });
      }}
      className={cn("flex flex-col gap-4")}
    >
      <Input
        label="Preço mensal (R$)"
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <p className="text-xs text-brand-graphite/50">
        O preço é configurável pelo administrador da plataforma e não
        fica fixo no código da aplicação.
      </p>
      <Button type="submit" fullWidth>
        Salvar plano
      </Button>
    </form>
  );
}
