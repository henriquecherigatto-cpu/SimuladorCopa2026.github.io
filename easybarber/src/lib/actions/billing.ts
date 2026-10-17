"use server";

import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";
import { getPaymentProvider } from "@/lib/billing/provider";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function assertOwner(role: string) {
  if (role !== "owner") {
    throw new Error("Apenas o proprietário pode gerenciar a assinatura.");
  }
}

/**
 * Starts a real checkout with the payment provider and returns its
 * hosted URL to redirect the browser to. This Server Action NEVER
 * marks anything as paid — it only ever creates a pending checkout.
 * subscriptions.status changes exclusively via the webhook route
 * (src/app/api/billing/webhook/route.ts) once the provider confirms
 * the charge; the browser returning from checkout proves nothing on
 * its own.
 */
export async function createCheckoutSession(
  planId: string,
  couponCode?: string,
  returnPath: string = "/plano",
): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const { supabase, companyId, role, userId } = await requireMembership();
    assertOwner(role);

    const provider = getPaymentProvider();
    if (!provider.isConfigured()) {
      throw new Error(
        "O pagamento ainda não está configurado nesta instância. Fale com o suporte para ativar a cobrança da sua barbearia.",
      );
    }

    const [{ data: company }, { data: subscription }, { data: profile }] = await Promise.all([
      supabase.from("companies").select("name, cnpj").eq("id", companyId).single(),
      supabase
        .from("subscriptions")
        .select("external_customer_id")
        .eq("company_id", companyId)
        .single(),
      supabase.from("profiles").select("email").eq("id", userId).single(),
    ]);

    if (!company) throw new Error("Barbearia não encontrada.");
    if (!company.cnpj) {
      throw new Error(
        "Cadastre o CPF ou CNPJ da sua barbearia em Configurações antes de assinar um plano.",
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, name, price_cents, active")
      .eq("id", planId)
      .eq("active", true)
      .single();
    if (planError || !plan) throw new Error("Plano não encontrado.");

    const email = profile?.email ?? "";
    if (!email) throw new Error("Não foi possível identificar o e-mail da conta.");

    // Redeemed only once every other validation above has already
    // passed — a checkout that fails for an unrelated reason (missing
    // CNPJ, unknown plan) must never consume the coupon.
    let firstPaymentDiscountPercent: number | undefined;
    if (couponCode?.trim()) {
      const { data: discount, error: couponError } = await supabase.rpc("redeem_coupon", {
        p_company_id: companyId,
        p_code: couponCode.trim(),
      });
      if (couponError) throw couponError;
      firstPaymentDiscountPercent = discount ?? undefined;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await provider.createCheckoutSession({
      companyId,
      planId: plan.id,
      planName: plan.name,
      priceCents: plan.price_cents,
      customerName: company.name,
      customerEmail: email,
      customerDocument: company.cnpj,
      existingExternalCustomerId: subscription?.external_customer_id ?? null,
      returnUrl: `${appUrl}${returnPath}?checkout=pendente`,
      firstPaymentDiscountPercent,
    });

    // Link this company to the provider's customer id so the webhook
    // can resolve future events back to it (subscriptions is
    // service_role/admin-write-only — see RLS policy subscriptions_write
    // — so this goes through the same trusted client the webhook
    // itself uses, not the caller's own session).
    const serviceRole = createServiceRoleClient();
    const { error: linkError } = await serviceRole
      .from("subscriptions")
      .update({
        external_customer_id: session.externalCustomerId,
        external_subscription_id: session.externalSubscriptionId,
        plan_id: plan.id,
      })
      .eq("company_id", companyId);

    if (linkError) {
      console.error("createCheckoutSession: failed to link external_customer_id", linkError);
      throw new Error("Não foi possível iniciar o checkout. Tente novamente em instantes.");
    }

    return { url: session.url };
  });
}

/**
 * The subscription's current open (not yet paid) charge, if any — so
 * the owner can always find the payment link from inside the app even
 * if Asaas's own notification (email) was missed or went to spam.
 * Read-only: see PaymentProvider.getOpenInvoice()'s own doc comment.
 */
export async function getOpenInvoiceLink(): Promise<
  ActionResult<{ url: string; dueDate: string; amountCents: number; overdue: boolean } | null>
> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    const provider = getPaymentProvider();
    if (!provider.isConfigured()) {
      throw new Error(
        "O pagamento ainda não está configurado nesta instância. Fale com o suporte para ativar a cobrança da sua barbearia.",
      );
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("external_customer_id")
      .eq("company_id", companyId)
      .single();

    if (!subscription?.external_customer_id) return null;

    return provider.getOpenInvoice(subscription.external_customer_id);
  });
}

/**
 * Read-only preview for the checkout UI: shows "X% off" the instant a
 * valid code is typed, before the owner commits to anything. Never
 * records a redemption — see createCheckoutSession's couponCode
 * handling for the call that actually consumes one.
 */
export async function previewCoupon(code: string): Promise<ActionResult<{ discountPercent: number } | null>> {
  return runAction(async () => {
    const { supabase } = await requireMembership();
    const { data, error } = await supabase.rpc("preview_coupon_discount", { p_code: code });
    if (error) throw error;
    return data == null ? null : { discountPercent: data };
  });
}
