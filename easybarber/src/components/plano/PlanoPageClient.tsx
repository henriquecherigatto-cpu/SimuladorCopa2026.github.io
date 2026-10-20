"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { AlertTriangle, Check, Copy, Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { SUPPORT_WHATSAPP_NUMBER } from "@/components/layout/SupportWhatsAppButton";
import { useRealtimeTable } from "@/lib/hooks/useRealtimeTable";
import { APP_TIMEZONE, buildWhatsAppLink, cn, formatCurrencyBRL } from "@/lib/utils";

type SubscriptionStatus = "pendente" | "ativa" | "tolerancia" | "suspensa" | "cancelada";

interface PlanRow {
  id: string;
  name: string;
  price_cents: number;
  features: unknown;
  coming_soon?: boolean;
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
  companyId,
  subscription,
  plans,
  billingEvents,
  canManage,
  pixKey,
  qrCodeUrl,
  copyPasteCode,
}: {
  companyId: string;
  subscription: SubscriptionRow;
  plans: PlanRow[];
  billingEvents: BillingEventRow[];
  canManage: boolean;
  pixKey: string | null;
  qrCodeUrl: string | null;
  copyPasteCode: string | null;
}) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = React.useState(false);

  // Payment is manual now: the admin checks their own Pix account and
  // activates access through the admin panel's "Liberar acesso" —
  // admin_grant_subscription_access() in
  // 20260101000025_admin_subscription_control.sql, built with exactly
  // this flow in mind. This stays subscribed so that the moment the
  // admin does that, this page updates itself (status badge, this Pix
  // block's visibility, billing history) with no reload — the owner
  // never has to come back and check manually.
  useRealtimeTable("subscriptions", `company_id=eq.${companyId}`, () => router.refresh());

  const supportLink = (message: string) => buildWhatsAppLink(SUPPORT_WHATSAPP_NUMBER, message);

  const needsPayment =
    subscription.status === "pendente" ||
    subscription.status === "tolerancia" ||
    subscription.status === "suspensa";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plano e assinatura"
        description="Acompanhe sua assinatura e histórico de pagamentos."
      />

      {subscription.status === "tolerancia" && (
        <Alert variant="warning" title="Pagamento pendente">
          {subscription.grace_period_ends_at
            ? `Pague via Pix (veja os dados abaixo) até ${formatDate(subscription.grace_period_ends_at)} para evitar a suspensão do acesso.`
            : "Pague via Pix (veja os dados abaixo) para evitar a suspensão do acesso."}
        </Alert>
      )}

      {subscription.status === "suspensa" && (
        <Alert variant="error" title="Acesso suspenso por falta de pagamento">
          Pague via Pix (veja os dados abaixo) e avise que pagou para liberarmos o acesso novamente.
        </Alert>
      )}

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

          {canManage && needsPayment && (
            <PixPaymentBlock
              amountCents={subscription.plan.price_cents}
              pixKey={pixKey}
              qrCodeUrl={qrCodeUrl}
              copyPasteCode={copyPasteCode}
              planName={subscription.plan.name}
            />
          )}

          {canManage && subscription.status === "ativa" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="danger" fullWidth onClick={() => setCancelOpen(true)}>
                Cancelar assinatura
              </Button>
            </div>
          )}

          {canManage && subscription.status === "cancelada" && (
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
                  {isCurrent ? (
                    <Badge variant="brand">Atual</Badge>
                  ) : (
                    plan.coming_soon && <Badge variant="neutral">Em desenvolvimento</Badge>
                  )}
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
                {!isCurrent &&
                  (plan.coming_soon ? (
                    <p className="text-center text-xs text-brand-graphite/50">
                      Em breve disponível para contratação.
                    </p>
                  ) : (
                    canManage && (
                      <Button
                        variant="secondary"
                        size="sm"
                        href={supportLink(
                          `Olá! Quero trocar o plano da minha barbearia para ${plan.name}.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Mudar para este plano
                      </Button>
                    )
                  ))}
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
                        {formatInTimeZone(event.created_at, APP_TIMEZONE, "dd/MM/yyyy", { locale: ptBR })}
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

      <Alert variant="info" title="Sobre o pagamento">
        Aceitamos apenas Pix. O pagamento é conferido manualmente pela nossa
        equipe — depois de pagar, avise pelo WhatsApp (botão acima) para
        agilizar a liberação do acesso.
      </Alert>

      <CancelSubscriptionModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        planName={subscription.plan.name}
      />
    </div>
  );
}

/**
 * Payment is a fixed, platform-wide Pix key + QR code (set by the
 * platform admin in /admin, see pix_payment_settings) instead of a
 * dynamically generated Asaas charge — the admin checks their own Pix
 * account and confirms manually. "Avisar que paguei" just opens
 * WhatsApp with the amount/plan pre-filled so the admin knows to go
 * check and use "Liberar acesso"; it doesn't confirm anything by
 * itself.
 */
/**
 * copyPasteCode (the Pix "copia e cola" EMV payload) is the primary
 * way to pay when set — pasting it into a banking app pre-fills the
 * exact amount along with the recipient, so there's no chance of
 * typing the wrong value. pixKey (the bare key) only identifies the
 * recipient; the payer still has to enter the amount by hand, so it's
 * kept as a smaller fallback, not the main call to action.
 */
function PixPaymentBlock({
  amountCents,
  pixKey,
  qrCodeUrl,
  copyPasteCode,
  planName,
}: {
  amountCents: number;
  pixKey: string | null;
  qrCodeUrl: string | null;
  copyPasteCode: string | null;
  planName: string;
}) {
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);

  const copyText = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — the
      // text is still fully visible and selectable by hand.
    }
  };

  if (!pixKey && !qrCodeUrl && !copyPasteCode) {
    return (
      <Alert variant="warning" title="Pagamento ainda não configurado">
        Fale com o suporte pelo WhatsApp para receber os dados de pagamento.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-black/10 p-4">
      <div>
        <p className="text-xs text-brand-graphite/50">Valor a pagar via Pix</p>
        <p className="text-2xl font-bold text-brand-graphite">
          {formatCurrencyBRL(amountCents / 100)}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {qrCodeUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external storage URL
          <img
            src={qrCodeUrl}
            alt="QR Code Pix"
            className="size-40 shrink-0 rounded-xl border border-black/10 object-contain"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {copyPasteCode && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-brand-graphite/50">
                Escaneie o QR Code ou copie o código Pix abaixo
              </p>
              <Button
                fullWidth
                icon={copiedCode ? <Check className="size-4" /> : <Copy className="size-4" />}
                onClick={() => copyText(copyPasteCode, setCopiedCode)}
              >
                {copiedCode ? "Código copiado!" : "Copiar código Pix"}
              </Button>
            </div>
          )}
          {pixKey && (
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="text-xs text-brand-graphite/50">
                {copyPasteCode ? "Ou pague direto com a chave Pix" : "Pague com a chave Pix"}
              </p>
              <div className="flex items-center gap-2 rounded-xl bg-brand-surface px-3.5 py-2.5">
                <code className="min-w-0 flex-1 truncate text-sm text-brand-graphite">{pixKey}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={copiedKey ? <Check className="size-4" /> : <Copy className="size-4" />}
                  onClick={() => copyText(pixKey, setCopiedKey)}
                >
                  {copiedKey ? "Copiado!" : "Copiar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Button
        fullWidth
        variant="secondary"
        icon={<WhatsAppIcon className="size-4" />}
        href={buildWhatsAppLink(
          SUPPORT_WHATSAPP_NUMBER,
          `Olá! Acabei de pagar via Pix a assinatura da minha barbearia (plano ${planName}, ${formatCurrencyBRL(amountCents / 100)}).`,
        )}
        target="_blank"
        rel="noopener noreferrer"
      >
        Avisar que paguei
      </Button>
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
