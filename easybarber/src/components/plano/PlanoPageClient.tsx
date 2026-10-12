"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Check, CreditCard, Receipt, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { billingHistory, demoCompany, plans, todayDate } from "@/lib/mock-data";
import { cn, formatCurrencyBRL } from "@/lib/utils";

const statusLabel: Record<typeof demoCompany.subscriptionStatus, string> = {
  ativa: "Ativa",
  pendente: "Pendente",
  tolerancia: "Em tolerância",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
};

const statusVariant: Record<
  typeof demoCompany.subscriptionStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  ativa: "success",
  pendente: "warning",
  tolerancia: "warning",
  suspensa: "danger",
  cancelada: "neutral",
};

export function PlanoPageClient() {
  const currentPlan = plans.find((p) => p.id === demoCompany.planId) ?? plans[0];
  const nextPayment = format(addDays(todayDate, 19), "yyyy-MM-dd");
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [demoNotice, setDemoNotice] = React.useState<string | null>(null);

  const showDemoNotice = (message: string) => {
    setDemoNotice(message);
    setTimeout(() => setDemoNotice(null), 5000);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plano e assinatura"
        description="Acompanhe sua assinatura e histórico de pagamentos."
      />

      {demoCompany.subscriptionStatus === "tolerancia" && (
        <Alert variant="warning" title="Pagamento pendente">
          Regularize seu pagamento em até 10 dias para evitar a suspensão do
          acesso.
        </Alert>
      )}

      {demoNotice && <Alert variant="info">{demoNotice}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Plano atual</CardTitle>
          <Badge variant={statusVariant[demoCompany.subscriptionStatus]}>
            {statusLabel[demoCompany.subscriptionStatus]}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-brand-graphite/50">
                {currentPlan.name}
              </p>
              <p className="text-3xl font-bold text-brand-graphite">
                {formatCurrencyBRL(currentPlan.price)}
                <span className="text-base font-medium text-brand-graphite/50">
                  /mês
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-brand-graphite/50">Próximo pagamento</p>
              <p className="text-sm font-semibold text-brand-graphite">
                {format(new Date(`${nextPayment}`), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {currentPlan.features.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-brand-graphite/70"
              >
                <Check className="size-4 shrink-0 text-brand-success" />
                {f}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              fullWidth
              icon={<CreditCard className="size-4" />}
              onClick={() =>
                showDemoNotice(
                  "Modo de demonstração: a integração com o provedor de pagamento (Asaas) ainda não está conectada.",
                )
              }
            >
              Gerenciar assinatura
            </Button>
            <Button variant="danger" fullWidth onClick={() => setCancelOpen(true)}>
              Cancelar assinatura
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planos disponíveis</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-4",
                  isCurrent ? "border-brand-orange bg-brand-orange/5" : "border-black/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-brand-graphite">
                    {plan.name}
                  </p>
                  {isCurrent && <Badge variant="brand">Atual</Badge>}
                </div>
                <p className="text-2xl font-bold text-brand-graphite">
                  {formatCurrencyBRL(plan.price)}
                  <span className="text-sm font-medium text-brand-graphite/50">
                    /mês
                  </span>
                </p>
                <ul className="flex flex-col gap-1.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-1.5 text-xs text-brand-graphite/60"
                    >
                      <Check className="mt-0.5 size-3 shrink-0 text-brand-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      showDemoNotice(
                        "Modo de demonstração: a troca de plano real ainda não está conectada ao provedor de pagamento.",
                      )
                    }
                  >
                    Mudar para este plano
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de cobranças</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {billingHistory.length === 0 ? (
            <p className="px-5 py-6 text-sm text-brand-graphite/50">
              Nenhuma cobrança registrada ainda.
            </p>
          ) : (
            <ul className="divide-y divide-black/5">
              {billingHistory.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-brand-surface text-brand-graphite/50">
                    <Receipt className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-graphite">
                      {b.description}
                    </p>
                    <p className="text-xs text-brand-graphite/50">
                      {format(new Date(`${b.date}T00:00:00`), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-brand-graphite">
                    {formatCurrencyBRL(b.amount)}
                  </span>
                  <Badge variant={b.status === "pago" ? "success" : b.status === "pendente" ? "warning" : "danger"}>
                    {b.status === "pago" ? "Pago" : b.status === "pendente" ? "Pendente" : "Falhou"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Alert variant="info" title="Segurança do pagamento">
        O Easy Barber não armazena dados completos de cartão. A confirmação
        de pagamento depende de eventos autenticados do provedor — nenhuma
        cobrança é marcada como paga apenas pelo retorno do checkout.
      </Alert>

      <CancelSubscriptionModal open={cancelOpen} onClose={() => setCancelOpen(false)} />
    </div>
  );
}

function CancelSubscriptionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Cancelar assinatura">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Ao cancelar, sua barbearia perde acesso aos recursos do plano ao
            final do período já pago. Seus dados são mantidos conforme a
            política de retenção.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-xl bg-brand-surface p-3 text-sm text-brand-graphite/70">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-orange" />
          <p>
            Este é um ambiente de demonstração — nenhuma assinatura real
            será cancelada.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Voltar
          </Button>
          <Button variant="danger" fullWidth onClick={onClose}>
            Confirmar cancelamento
          </Button>
        </div>
      </div>
    </Modal>
  );
}
