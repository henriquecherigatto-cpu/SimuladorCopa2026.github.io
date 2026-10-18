"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";
import { onboardingStepRoute } from "@/lib/onboarding";

function assertOwner(role: string) {
  if (role !== "owner") {
    throw new Error("Apenas o proprietário pode concluir o cadastro da barbearia.");
  }
}

/**
 * Advances companies.onboarding_step by exactly one, after
 * independently verifying — server-side, under the caller's own
 * RLS-scoped session, never trusting the client's say-so — that the
 * step being left is actually satisfied: >=1 service to leave step 1
 * (servicos), >=1 professional to leave step 2 (profissionais). Step
 * 0 (horarios) has no such precondition: business_hours always has 7
 * rows already (defaulted at signup — see create_company_with_owner()
 * in 20260101000038_onboarding_steps.sql), so confirming this step is
 * simply the owner reviewing/saving them once via updateBusinessHours()
 * (called separately, just before this).
 *
 * The actual step advance is a compare-and-swap
 * (advance_onboarding_step() in the same migration) — a double-submit
 * can only ever advance once.
 */
export async function advanceOnboardingStep(
  expectedStep: 0 | 1 | 2,
): Promise<ActionResult<{ nextRoute: string }>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    if (expectedStep === 1) {
      const { count, error } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (error) throw error;
      if (!count) throw new Error("Cadastre ao menos um serviço antes de continuar.");
    }

    if (expectedStep === 2) {
      const { count, error } = await supabase
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (error) throw error;
      if (!count) throw new Error("Cadastre ao menos um profissional antes de continuar.");
    }

    const { data: advanced, error } = await supabase.rpc("advance_onboarding_step", {
      p_company_id: companyId,
      p_expected_step: expectedStep,
    });
    if (error) throw error;
    if (!advanced) {
      throw new Error(
        "Não foi possível avançar para a próxima etapa. Atualize a página e tente novamente.",
      );
    }

    revalidatePath("/onboarding/horarios");
    revalidatePath("/onboarding/servicos");
    revalidatePath("/onboarding/profissionais");
    revalidatePath("/dashboard");

    return { nextRoute: onboardingStepRoute(expectedStep + 1) };
  });
}
