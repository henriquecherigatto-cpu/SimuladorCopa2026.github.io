"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";

export interface CompanySettingsInput {
  name: string;
  phone: string;
  whatsappNumber?: string;
  address?: string;
  cnpj?: string;
}

function assertOwner(role: string) {
  if (role !== "owner") {
    throw new Error("Apenas o proprietário pode gerenciar os dados da barbearia.");
  }
}

export async function updateCompanySettings(
  input: CompanySettingsInput,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    if (!input.name.trim()) throw new Error("Informe o nome da barbearia.");
    if (!input.phone.trim()) throw new Error("Informe o telefone da barbearia.");

    const { error } = await supabase
      .from("companies")
      .update({
        name: input.name.trim(),
        phone: input.phone.trim(),
        whatsapp_number: input.whatsappNumber?.trim() || null,
        address: input.address?.trim() || null,
        cnpj: input.cnpj?.trim() || null,
      })
      .eq("id", companyId);
    if (error) throw error;

    // /agendar/<slug> is already fully dynamic (no caching to bust) —
    // it reads this row fresh on every visit, so no revalidatePath is
    // needed there.
    revalidatePath("/configuracoes");
    return undefined;
  });
}
