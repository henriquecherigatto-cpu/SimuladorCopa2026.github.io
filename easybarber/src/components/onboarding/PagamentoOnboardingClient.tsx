"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Loader2, Tag } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { createCheckoutSession, getOpenInvoiceLink, previewCoupon } from "@/lib/actions/billing";
import { useRealtimeTable } from "@/lib/hooks/useRealtimeTable";
import { createClient } from "@/lib/supabase/client";
import { onboardingStepRoute } from "@/lib/onboarding";
import { cn, formatCurrencyBRL } from "@/lib/utils";

/**
 * Opens the Asaas invoice in its own tab instead of navigating this
 * one away to it. Asaas's hosted Pix page never redirects back to us
 * on its own — a full-page redirect (window.location.href) would
 * strand the owner there with no way back, AND it unmounts this
 * component, killing the Realtime listener below that's what
 * actually detects the payment and moves them forward. Keeping this
 * tab alive is what makes that listener able to do its job.
 *
 * Opened synchronously, before the async checkout-session call, so
 * the browser still attributes it to the click (a popup opened after
 * an await is commonly blocked, e.g. in Safari) — its location is set
 * once the real URL is known. Falls back to navigating this tab if
 * the popup was blocked anyway (strict blocker settings).
 */
function openInvoiceTab(url: string, popup: Window | null) {
  if (popup && !popup.closed) {
    popup.location.href = url;
  } else {
    window.location.href = url;
  }
}

interface PlanRow {
  id: string;
  name: string;
  price_cents: number;
  features: unknown;
}

function asFeatureList(features: unknown): string[] {
  return Array.isArray(features) ? features.filter((f): f is string => typeof f === "string") : [];
}

function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-surface px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}

export function PagamentoOnboardingClient({
  companyId,
  plans,
  currentPlanId,
  awaitingConfirmation,
}: {
  companyId: string;
  plans: PlanRow[];
  currentPlanId: string;
  awaitingConfirmation: boolean;
}) {
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = React.useState(currentPlanId);
  const [couponInput, setCouponInput] = React.useState("");
  const [couponState, setCouponState] = React.useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [discountPercent, setDiscountPercent] = React.useState<number | null>(null);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [waiting, setWaiting] = React.useState(awaitingConfirmation);
  const [resuming, setResuming] = React.useState(false);
  const [resumeError, setResumeError] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponState("checking");
    const result = await previewCoupon(code);
    if (!result.ok || !result.data) {
      setCouponState("invalid");
      setDiscountPercent(null);
      return;
    }
    setCouponState("valid");
    setDiscountPercent(result.data.discountPercent);
  };

  const handleCheckout = async () => {
    setCheckoutError(null);
    setSubmitting(true);
    const popup = window.open("", "_blank");
    const result = await createCheckoutSession(
      selectedPlanId,
      couponState === "valid" ? couponInput.trim() : undefined,
      "/onboarding/pagamento",
    );
    if (!result.ok) {
      popup?.close();
      setSubmitting(false);
      setCheckoutError(result.error);
      return;
    }
    openInvoiceTab(result.data.url, popup);
    setSubmitting(false);
    setWaiting(true);
  };

  // Once the webhook confirms the payment, subscriptions.status flips
  // away from 'pendente' — jump straight into the onboarding sequence
  // the instant that happens, no manual reload needed. Always step 0
  // (horários) here: this page's own server-side guard never renders
  // this component unless the company is still pendente, and every
  // wizard step page itself redirects back to /onboarding/pagamento
  // while pendente — so nothing could have advanced onboarding_step
  // past 0 while payment was still outstanding.
  const checkIfPaid = React.useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("company_id", companyId)
      .maybeSingle();
    if (data && data.status !== "pendente") {
      router.push(onboardingStepRoute(0));
      router.refresh();
    }
  }, [companyId, router]);

  useRealtimeTable("subscriptions", `company_id=eq.${companyId}`, checkIfPaid);

  const handleManualCheck = async () => {
    setChecking(true);
    await checkIfPaid();
    setChecking(false);
  };

  // Re-opens the SAME still-pending Pix charge instead of starting a
  // new checkout — calling createCheckoutSession again here would
  // create a second, duplicate charge/subscription on Asaas.
  const handleResume = async () => {
    setResuming(true);
    setResumeError(null);
    const popup = window.open("", "_blank");
    const result = await getOpenInvoiceLink();
    setResuming(false);
    if (!result.ok) {
      popup?.close();
      setResumeError(result.error);
      return;
    }
    if (!result.data) {
      popup?.close();
      setResumeError("Nenhuma cobrança em aberto encontrada.");
      return;
    }
    openInvoiceTab(result.data.url, popup);
  };

  if (waiting) {
    return (
      <OnboardingShell>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <Loader2 className="size-8 animate-spin text-brand-orange" />
          <h1 className="text-lg font-bold text-brand-graphite">
            Aguardando confirmação do pagamento
          </h1>
          <p className="text-sm text-brand-graphite/60">
            O Pix abriu em uma nova aba. Pague por lá e volte para esta
            aba — assim que for confirmado, você é liberado
            automaticamente, não precisa recarregar a página.
          </p>
          {resumeError && (
            <div className="flex flex-col items-center gap-2">
              <Alert variant="error">{resumeError}</Alert>
              <button
                type="button"
                onClick={() => setWaiting(false)}
                className="text-xs font-medium text-brand-orange underline"
              >
                Escolher o plano novamente
              </button>
            </div>
          )}
          <div className="flex w-full flex-col gap-2">
            <Button variant="secondary" fullWidth loading={resuming} onClick={handleResume}>
              Ver código Pix novamente
            </Button>
            <Button variant="secondary" fullWidth loading={checking} onClick={handleManualCheck}>
              Já paguei, verificar agora
            </Button>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const basePrice = selectedPlan ? selectedPlan.price_cents / 100 : 0;
  const discountedPrice = discountPercent ? (basePrice * (100 - discountPercent)) / 100 : basePrice;

  return (
    <OnboardingShell>
      <h1 className="mb-1 text-lg font-bold text-brand-graphite">Escolha seu plano</h1>
      <p className="mb-5 text-sm text-brand-graphite/60">
        Para começar a usar o Easy Barber, confirme o pagamento da primeira
        mensalidade via Pix.
      </p>

      {checkoutError && <Alert variant="error">{checkoutError}</Alert>}

      <div className="mb-5 flex flex-col gap-3">
        {plans.map((plan) => {
          const isSelected = plan.id === selectedPlanId;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
                isSelected ? "border-brand-orange bg-brand-orange/5" : "border-black/10",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-graphite">{plan.name}</p>
                <p className="text-lg font-bold text-brand-graphite">
                  {formatCurrencyBRL(plan.price_cents / 100)}
                  <span className="text-xs font-medium text-brand-graphite/50">/mês</span>
                </p>
              </div>
              <ul className="flex flex-col gap-1">
                {asFeatureList(plan.features).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-brand-graphite/60">
                    <Check className="mt-0.5 size-3 shrink-0 text-brand-success" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="mb-5 flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            placeholder="Cupom de desconto (opcional)"
            leftIcon={<Tag className="size-4" />}
            value={couponInput}
            onChange={(e) => {
              setCouponInput(e.target.value.toUpperCase());
              setCouponState("idle");
              setDiscountPercent(null);
            }}
          />
          <Button variant="secondary" loading={couponState === "checking"} onClick={applyCoupon}>
            Aplicar
          </Button>
        </div>
        {couponState === "valid" && discountPercent !== null && (
          <p className="text-sm font-medium text-brand-success">
            Cupom aplicado: {discountPercent}% de desconto na primeira mensalidade.
          </p>
        )}
        {couponState === "invalid" && (
          <p className="text-sm text-brand-error">Cupom inválido ou expirado.</p>
        )}
      </div>

      {discountPercent !== null && (
        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-sm text-brand-graphite/40 line-through">
            {formatCurrencyBRL(basePrice)}
          </span>
          <span className="text-xl font-bold text-brand-graphite">
            {formatCurrencyBRL(discountedPrice)}
          </span>
          <span className="text-xs text-brand-graphite/50">na primeira mensalidade</span>
        </div>
      )}

      <Button
        fullWidth
        icon={<CreditCard className="size-4" />}
        loading={submitting}
        disabled={!selectedPlanId}
        onClick={handleCheckout}
      >
        Pagar com Pix e começar a usar
      </Button>
    </OnboardingShell>
  );
}
