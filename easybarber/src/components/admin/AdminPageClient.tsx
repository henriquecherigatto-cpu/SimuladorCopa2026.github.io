"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Ban,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  MessageCircle,
  Pencil,
  Search,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SubscriptionStatusBadge } from "@/components/ui/StatusBadge";
import { RevenueChart } from "@/components/admin/RevenueChart";
import {
  updatePlanPrice,
  updateSubscriptionStatus,
  type AdminAuditLogRow,
  type AdminCompanyRow,
  type AdminPlanRow,
  type AdminPlatformMetrics,
  type AdminRevenuePoint,
} from "@/lib/actions/admin";
import { cn, formatCurrencyBRL } from "@/lib/utils";

export function AdminPageClient({
  companies,
  metrics,
  revenue,
  plans,
  auditLog,
}: {
  companies: AdminCompanyRow[];
  metrics: AdminPlatformMetrics;
  revenue: AdminRevenuePoint[];
  plans: AdminPlanRow[];
  auditLog: AdminAuditLogRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [editingPlan, setEditingPlan] = React.useState<AdminPlanRow | null>(null);
  const [suspendTarget, setSuspendTarget] = React.useState<AdminCompanyRow | null>(null);
  const [busyCompanyId, setBusyCompanyId] = React.useState<string | null>(null);

  const filtered = companies.filter((c) =>
    c.company_name.toLowerCase().includes(query.toLowerCase()),
  );

  const atRisk = companies.filter(
    (c) => c.subscription_status === "pendente" || c.subscription_status === "tolerancia",
  ).length;

  const handleReactivate = async (company: AdminCompanyRow) => {
    setBusyCompanyId(company.company_id);
    const result = await updateSubscriptionStatus(company.company_id, "ativa");
    setBusyCompanyId(null);
    if (result.ok) router.refresh();
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setBusyCompanyId(suspendTarget.company_id);
    const result = await updateSubscriptionStatus(suspendTarget.company_id, "suspensa");
    setBusyCompanyId(null);
    if (result.ok) {
      setSuspendTarget(null);
      router.refresh();
    }
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard icon={Building2} label="Empresas cadastradas" value={metrics.total_companies} tone="graphite" />
        <StatCard icon={CheckCircle2} label="Empresas ativas" value={metrics.active_companies} tone="success" />
        <StatCard icon={TrendingUp} label="MRR estimado" value={formatCurrencyBRL(metrics.mrr_cents / 100)} tone="orange" />
        <StatCard icon={Ban} label="Em risco de suspensão" value={atRisk} tone="graphite" />
        <StatCard
          icon={CalendarCheck2}
          label="Agendamentos este mês"
          value={metrics.appointments_this_month}
          hint={`${metrics.total_appointments} no total`}
          tone="orange"
        />
        <StatCard
          icon={MessageCircle}
          label="Custo WhatsApp este mês"
          value={formatCurrencyBRL(metrics.whatsapp_cost_cents_this_month / 100)}
          hint={`${metrics.total_whatsapp_messages} mensagens no total`}
          tone="graphite"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo de caixa</CardTitle>
          <p className="text-xs text-brand-graphite/50">
            Pagamentos de assinatura confirmados, últimos {revenue.length} meses.
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          <RevenueChart data={revenue} />
        </CardContent>
      </Card>

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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-brand-graphite/40">
                  <th className="px-5 py-3 font-medium">Empresa</th>
                  <th className="px-5 py-3 font-medium">Plano</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Agendamentos</th>
                  <th className="px-5 py-3 font-medium">WhatsApp</th>
                  <th className="px-5 py-3 font-medium">Próx. pagamento</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filtered.map((c) => (
                  <tr key={c.company_id}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-brand-graphite">{c.company_name}</p>
                      <p className="text-xs text-brand-graphite/50">
                        {c.professional_count} profissionais · {c.customer_count} clientes
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-brand-graphite/70">
                      {c.plan_name ?? "—"}
                      {c.plan_price_cents != null && (
                        <p className="text-xs text-brand-graphite/40">
                          {formatCurrencyBRL(c.plan_price_cents / 100)}/mês
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <SubscriptionStatusBadge status={c.subscription_status} />
                    </td>
                    <td className="px-5 py-3.5 text-brand-graphite/70">
                      {c.appointment_count}
                      <p className="text-xs text-brand-graphite/40">
                        {c.appointments_this_month} este mês
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-brand-graphite/70">
                      {c.whatsapp_message_count}
                      <p className="text-xs text-brand-graphite/40">
                        {formatCurrencyBRL(c.whatsapp_cost_cents / 100)} total
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-brand-graphite/70">
                      {c.next_payment_date
                        ? format(new Date(`${c.next_payment_date}T00:00:00`), "dd/MM/yyyy")
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant={c.subscription_status === "suspensa" ? "secondary" : "danger"}
                        loading={busyCompanyId === c.company_id}
                        onClick={() =>
                          c.subscription_status === "suspensa"
                            ? handleReactivate(c)
                            : setSuspendTarget(c)
                        }
                      >
                        {c.subscription_status === "suspensa" ? "Reativar" : "Suspender"}
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
                    {!plan.active && (
                      <span className="ml-2 text-xs font-normal text-brand-graphite/40">
                        (inativo)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-brand-graphite/50">
                    {formatCurrencyBRL(plan.price_cents / 100)}/mês ·{" "}
                    {plan.max_professionals
                      ? `até ${plan.max_professionals} profissionais`
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
            {plans.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-brand-graphite/50">
                Nenhum plano cadastrado.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registro de ações administrativas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="scrollbar-thin max-h-72 divide-y divide-black/5 overflow-y-auto">
              {auditLog.map((entry) => (
                <li key={entry.id} className="px-5 py-3">
                  <p className="text-sm text-brand-graphite">
                    {describeAuditAction(entry)}
                  </p>
                  <p className="text-xs text-brand-graphite/40">
                    {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </li>
              ))}
              {auditLog.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-brand-graphite/50">
                  Nenhuma ação registrada ainda.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <EditPlanModal
        plan={editingPlan}
        onClose={() => setEditingPlan(null)}
        onSaved={() => {
          setEditingPlan(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!suspendTarget}
        title="Suspender esta empresa?"
        description={
          suspendTarget
            ? `${suspendTarget.company_name} perde acesso ao sistema até ser reativada. Isso não cancela a assinatura, apenas bloqueia o uso.`
            : ""
        }
        confirmLabel="Suspender"
        busy={!!suspendTarget && busyCompanyId === suspendTarget.company_id}
        onConfirm={handleSuspend}
        onClose={() => setSuspendTarget(null)}
      />
    </div>
  );
}

function describeAuditAction(entry: AdminAuditLogRow): string {
  const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
  switch (entry.action) {
    case "plan_price_updated": {
      const name = typeof metadata.plan_name === "string" ? metadata.plan_name : "um plano";
      const price = typeof metadata.new_price_cents === "number" ? metadata.new_price_cents : null;
      return `Preço do plano ${name} atualizado${price != null ? ` para ${formatCurrencyBRL(price / 100)}` : ""}`;
    }
    case "subscription_status_changed": {
      const from = typeof metadata.from === "string" ? metadata.from : "?";
      const to = typeof metadata.to === "string" ? metadata.to : "?";
      return `Status de assinatura alterado de ${from} para ${to}`;
    }
    default:
      return entry.action.replaceAll("_", " ");
  }
}

function EditPlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: AdminPlanRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal open={!!plan} onClose={onClose} title={plan ? `Editar ${plan.name}` : ""}>
      {plan && <EditPlanFormFields plan={plan} onSaved={onSaved} />}
    </Modal>
  );
}

function EditPlanFormFields({
  plan,
  onSaved,
}: {
  plan: AdminPlanRow;
  onSaved: () => void;
}) {
  const [price, setPrice] = React.useState((plan.price_cents / 100).toFixed(2).replace(".", ","));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = Number(price.replace(/\./g, "").replace(",", "."));
    if (!value || value <= 0) {
      setError("Informe um preço válido.");
      return;
    }
    setSubmitting(true);
    const result = await updatePlanPrice(plan.id, Math.round(value * 100));
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-4")}>
      {error && <Alert variant="error">{error}</Alert>}
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
      <Button type="submit" fullWidth loading={submitting}>
        Salvar plano
      </Button>
    </form>
  );
}
