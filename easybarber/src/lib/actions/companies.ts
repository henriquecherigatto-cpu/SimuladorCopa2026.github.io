"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";
import { WEEKDAY_LABELS } from "@/lib/utils";

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

export interface BusinessHoursInput {
  /** A WEEKDAY_LABELS entry, e.g. "Segunda-feira". */
  day: string;
  open: boolean;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" */
  end: string;
}

/**
 * Upserts all 7 days at once (the form always submits the full week).
 * Mirrors the day_of_week convention business_hours and every other
 * weekday-indexed table in this app already uses — see WEEKDAY_LABELS.
 */
export async function updateBusinessHours(
  hours: BusinessHoursInput[],
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    const rows = hours.map((h) => {
      const day_of_week = WEEKDAY_LABELS.indexOf(h.day);
      if (day_of_week === -1) {
        throw new Error(`Dia da semana inválido: ${h.day}`);
      }
      if (h.open && h.start >= h.end) {
        throw new Error(
          `Em ${h.day}, o horário de abertura precisa ser antes do horário de fechamento.`,
        );
      }
      return {
        company_id: companyId,
        day_of_week,
        is_open: h.open,
        start_time: h.start,
        end_time: h.end,
      };
    });

    const { error } = await supabase
      .from("business_hours")
      .upsert(rows, { onConflict: "company_id,day_of_week" });
    if (error) throw error;

    revalidatePath("/configuracoes");
    return undefined;
  });
}
