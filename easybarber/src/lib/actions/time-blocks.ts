"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";
import { APP_TIMEZONE } from "@/lib/utils";

/**
 * Company-wide scheduled closures (a holiday, a full-day or partial
 * shutdown) — not a per-professional break. Backed by the existing
 * time_blocks table (professional_id = null means "the whole
 * company"), which check_appointment_within_hours() and
 * get_available_slots() already treat as a hard block — this file is
 * only the missing owner-facing CRUD on top of a schema that already
 * enforces it.
 */

function assertOwner(role: string) {
  if (role !== "owner") {
    throw new Error("Apenas o proprietário pode gerenciar bloqueios da agenda.");
  }
}

export interface TimeBlockInput {
  date: string; // yyyy-MM-dd
  allDay: boolean;
  startTime?: string; // HH:mm, required when !allDay
  endTime?: string; // HH:mm, required when !allDay
  reason?: string;
}

export interface CompanyTimeBlockRow {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

function revalidateAgenda() {
  revalidatePath("/agenda");
  revalidatePath("/agenda/dia");
  revalidatePath("/agenda/novo");
}

export async function listCompanyTimeBlocks(): Promise<ActionResult<CompanyTimeBlockRow[]>> {
  return runAction(async () => {
    const { supabase, companyId } = await requireMembership();

    const { data, error } = await supabase
      .from("time_blocks")
      .select("id, starts_at, ends_at, reason")
      .eq("company_id", companyId)
      .is("professional_id", null)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  });
}

export async function createCompanyTimeBlock(
  input: TimeBlockInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, companyId, userId, role } = await requireMembership();
    assertOwner(role);

    if (!input.date) throw new Error("Selecione uma data.");

    let startsAt: Date;
    let endsAt: Date;
    if (input.allDay) {
      startsAt = fromZonedTime(`${input.date}T00:00:00`, APP_TIMEZONE);
      endsAt = fromZonedTime(`${input.date}T23:59:59.999`, APP_TIMEZONE);
    } else {
      if (!input.startTime || !input.endTime) {
        throw new Error("Informe o horário de início e fim do bloqueio.");
      }
      if (input.startTime >= input.endTime) {
        throw new Error("O horário de início deve ser antes do horário de fim.");
      }
      startsAt = fromZonedTime(`${input.date}T${input.startTime}:00`, APP_TIMEZONE);
      endsAt = fromZonedTime(`${input.date}T${input.endTime}:00`, APP_TIMEZONE);
    }

    const { data, error } = await supabase
      .from("time_blocks")
      .insert({
        company_id: companyId,
        professional_id: null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: input.reason?.trim() || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidateAgenda();
    return data;
  });
}

export async function deleteCompanyTimeBlock(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const { error } = await supabase
      .from("time_blocks")
      .delete()
      .eq("id", id)
      .is("professional_id", null);

    if (error) throw error;

    revalidateAgenda();
    return undefined;
  });
}
