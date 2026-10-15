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
      returnUrl: `${appUrl}/plano?checkout=pendente`,
    });

    // Link this company to the provider's customer id so the webhook
    // can resolve future events back to it (subscriptions is
    // service_role/admin-write-only — see RLS policy subscriptions_write
    // — so this goes through the same trusted client the webhook
    // itself uses, not the caller's own session).
    const serviceRole = createServiceRoleClient();
    const { error: linkError } = await serviceRole
      .from("subscriptions")
      .update({ external_customer_id: session.externalCustomerId, plan_id: plan.id })
      .eq("company_id", companyId);

    if (linkError) {
      console.error("createCheckoutSession: failed to link external_customer_id", linkError);
      throw new Error("Não foi possível iniciar o checkout. Tente novamente em instantes.");
    }

    return { url: session.url };
  });
}
