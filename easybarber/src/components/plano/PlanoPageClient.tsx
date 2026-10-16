"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Check, CreditCard, Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { SUPPORT_WHATSAPP_NUMBER } from "@/components/layout/SupportWhatsAppButton";
import { createCheckoutSession } from "@/lib/actions/billing";
import { buildWhatsAppLink, cn, formatCurrencyBRL } from "@/lib/utils";

type SubscriptionStatus = "pendente" | "ativa" | "tolerancia" | "suspensa" | "cancelada";

interface PlanRow {
  id: string;
  name: string;
  price_cents: number;
  features: unknown;
}

interface SubscriptionRow {
  status: SubscriptionStatus;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  plan: PlanRow;
}

interface BillingEventRow {
  id: string;
  event_type: string;
  status: string;
  amount_cents: number | null;
  created_at: string;
}

const statusLabel: Record<SubscriptionStatus, string> = {
  ativa: "Ativa",
  pendente: "Pendente",
  tolerancia: "Em tolerância",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
};

const statusVariant: Record<SubscriptionStatus, "success" | "warning" | "danger" | "neutral"> = {
  ativa: "success",
  pendente: "warning",
  tolerancia: "warning",
  suspensa: "danger",
  cancelada: "neutral",
};

const eventLabel: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  payment_confirmed: { label: "Pagamento confirmado", variant: "success" },
  payment_overdue: { label: "Pagamento em atraso", variant: "warning" },
  subscription_canceled: { label: "Assinatura cancelada", variant: "danger" },
};

function asFeatureList(features: unknown): string[] {
  return Array.isArray(features) ? features.filter((f): f is string => typeof f === "string") : [];
}

function formatDate(isoDate: string): string {
  return format(new Date(`${isoDate}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

export function PlanoPageClient({
  subscription,
  plans,
  billingEvents,
  canManage,
}: {
  subscription: SubscriptionRow;
  plans: PlanRow[];
  billingEvents: BillingEventRow[];
  canManage: boolean;
}) {
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [checkoutLoadingPlanId, setCheckoutLoadingPlanId] = React.useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  // A real Asaas subscription (recurring Pix) only exists once the
  // owner has gone through checkout at least once. Before that,
  // starting a new checkout is always safe. Afterwards (ativa,
  // tolerancia, suspensa all imply a subscription already exists on
  // Asaas's side), calling createCheckoutSession again would create a
  // SECOND concurrent recurring subscription — Asaas itself already
  // auto-generates the next monthly charge, and a lapsed payment is
  // resolved by paying the invoice Asaas already generated (the owner
  // gets a WhatsApp reminder — see notifyCompanyEnteringGracePeriod),
  // not by starting over. Switching plans or cancelling once a
  // subscription is live goes through support until real Asaas
  // subscription-replacement/cancellation is built.
  const canStartCheckout = subscription.status === "pendente";

  const startCheckout = async (planId: string) => {
    setCheckoutError(null);
    setCheckoutLoadingPlanId(planId);
    const result = await createCheckoutSession(planId);
    if (!result.ok) {
      setCheckoutLoadingPlanId(null);
      setCheckoutError(result.error);
      return;
    }
    window.location.href = result.data.url;
  };

  const supportLink = (message: string) => buildWhatsAppLink(SUPPORT_WHATSAPP_NUMBER, message);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plano e assinatura"
        description="Acompanhe sua assinatura e histórico de pagamentos."
      />

      {subscription.status === "tolerancia" && (
        <Alert variant="warning" title="Pagamento pendente">
          {subscription.grace_period_ends_at
            ? `Regularize o pagamento já gerado no Pix/Asaas até ${formatDate(subscription.grace_period_ends_at)} para evitar a suspensão do acesso.`
            : "Regularize o pagamento já gerado no Pix/Asaas para evitar a suspensão do acesso."}
        </Alert>
      )}

      {subscription.status === "suspensa" && (
        <Alert variant="error" title="Acesso suspenso por falta de pagamento">
          Fale com o suporte pelo WhatsApp para regularizar e liberar o acesso novamente.
        </Alert>
      )}

      {checkoutError && <Alert variant="error">{checkoutError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Plano atual</CardTitle>
          <Badge variant={statusVariant[subscription.status]}>
            {statusLabel[subscription.status]}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-brand-graphite/50">{subscription.plan.name}</p>
              <p className="text-3xl font-bold text-brand-graphite">
                {formatCurrencyBRL(subscription.plan.price_cents / 100)}
                <span className="text-base font-medium text-brand-graphite/50">/mês</span>
              </p>
            </div>
            {subscription.current_period_end && (
              <div className="text-right">
                <p className="text-xs text-brand-graphite/50">Próximo pagamento</p>
                <p className="text-sm font-semibold text-brand-graphite">
                  {formatDate(subscription.current_period_end)}
                </p>
              </div>
            )}
          </div>

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {asFeatureList(subscription.plan.features).map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-brand-graphite/70">
                <Check className="size-4 shrink-0 text-brand-success" />
                {f}
              </li>
            ))}
          </ul>

          {canManage && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {canStartCheckout ? (
                <Button
                  fullWidth
                  icon={<CreditCard className="size-4" />}
                  loading={checkoutLoadingPlanId === subscription.plan.id}
                  disabled={checkoutLoadingPlanId !== null}
                  onClick={() => startCheckout(subscription.plan.id)}
                >
                  Assinar agora via Pix
                </Button>
              ) : (
                subscription.status !== "cancelada" && (
                  <Button
                    fullWidth
                    variant="secondary"
                    icon={<WhatsAppIcon className="size-4" />}
                    href={supportLink(
                      `Olá! Preciso de ajuda com a assinatura da minha barbearia (plano ${subscription.plan.name}).`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Falar com o suporte
                  </Button>
                )
              )}
              {subscription.status === "ativa" && (
                <Button variant="danger" fullWidth onClick={() => setCancelOpen(true)}>
                  Cancelar assinatura
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planos disponíveis</CardTitle>
        </CardHeader>
        <CardContent className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent = plan.id === subscription.plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-4",
                  isCurrent ? "border-brand-orange bg-brand-orange/5" : "border-black/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-brand-graphite">{plan.name}</p>
                  {isCurrent && <Badge variant="brand">Atual</Badge>}
                </div>
                <p className="text-2xl font-bold text-brand-graphite">
                  {formatCurrencyBRL(plan.price_cents / 100)}
                  <span className="text-sm font-medium text-brand-graphite/50">/mês</span>
                </p>
                <ul className="flex flex-col gap-1.5">
                  {asFeatureList(plan.features).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-brand-graphite/60">
                      <Check className="mt-0.5 size-3 shrink-0 text-brand-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && canManage && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={checkoutLoadingPlanId === plan.id}
                    disabled={checkoutLoadingPlanId !== null && !canStartCheckout}
                    onClick={() =>
                      canStartCheckout
                        ? startCheckout(plan.id)
                        : window.open(
                            supportLink(
                              `Olá! Quero trocar o plano da minha barbearia para ${plan.name}.`,
                            ),
                            "_blank",
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
          {billingEvents.length === 0 ? (
            <p className="px-5 py-6 text-sm text-brand-graphite/50">
              Nenhuma cobrança registrada ainda.
            </p>
          ) : (
            <ul className="divide-y divide-black/5">
              {billingEvents.map((event) => {
                const { label, variant } = eventLabel[event.event_type] ?? {
                  label: event.event_type,
                  variant: "neutral" as const,
                };
                return (
                  <li key={event.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-brand-surface text-brand-graphite/50">
                      <Receipt className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-brand-graphite">{label}</p>
                      <p className="text-xs text-brand-graphite/50">
                        {format(new Date(event.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    {event.amount_cents !== null && (
                      <span className="text-sm font-semibold text-brand-graphite">
                        {formatCurrencyBRL(event.amount_cents / 100)}
                      </span>
                    )}
                    <Badge variant={variant}>{label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Alert variant="info" title="Segurança do pagamento">
        O Easy Barber não armazena dados completos de cartão. A confirmação
        de pagamento depende de eventos autenticados do provedor — nenhuma
        cobrança é marcada como paga apenas pelo retorno do checkout.
        Aceitamos apenas Pix.
      </Alert>

      <CancelSubscriptionModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        planName={subscription.plan.name}
      />
    </div>
  );
}

function CancelSubscriptionModal({
  open,
  onClose,
  planName,
}: {
  open: boolean;
  onClose: () => void;
  planName: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Cancelar assinatura">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Ao cancelar, sua barbearia perde acesso aos recursos do plano ao
            final do período já pago.
          </p>
        </div>
        <p className="text-sm text-brand-graphite/70">
          O cancelamento é feito pelo nosso suporte para confirmar os detalhes
          com você antes de encerrar a cobrança no Pix.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant="danger"
            fullWidth
            icon={<WhatsAppIcon className="size-4" />}
            href={buildWhatsAppLink(
              SUPPORT_WHATSAPP_NUMBER,
              `Olá! Quero cancelar a assinatura da minha barbearia (plano ${planName}).`,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Falar com o suporte
          </Button>
        </div>
      </div>
    </Modal>
  );
}
