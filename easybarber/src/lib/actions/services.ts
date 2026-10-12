"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";
import type { Database } from "@/lib/supabase/database.types";

export interface ServiceInput {
  name: string;
  description?: string;
  durationMin: number;
  priceCents: number;
}

function assertOwner(role: string) {
  if (role !== "owner") {
    throw new Error("Apenas o proprietário pode gerenciar serviços.");
  }
}

export async function createService(
  input: ServiceInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    if (!input.name.trim()) throw new Error("Informe o nome do serviço.");
    if (!input.durationMin || input.durationMin <= 0) {
      throw new Error("Informe uma duração válida em minutos.");
    }
    if (!input.priceCents || input.priceCents <= 0) {
      throw new Error("Informe um preço válido.");
    }

    const { data, error } = await supabase
      .from("services")
      .insert({
        company_id: companyId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        duration_min: input.durationMin,
        price_cents: input.priceCents,
      })
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/servicos");
    revalidatePath("/agenda/novo");
    return data;
  });
}

export async function updateService(
  serviceId: string,
  input: Partial<ServiceInput>,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const patch: Database["public"]["Tables"]["services"]["Update"] = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) {
      patch.description = input.description.trim() || null;
    }
    if (input.durationMin !== undefined) patch.duration_min = input.durationMin;
    if (input.priceCents !== undefined) patch.price_cents = input.priceCents;

    const { error } = await supabase
      .from("services")
      .update(patch)
      .eq("id", serviceId);

    if (error) throw error;
    revalidatePath("/servicos");
    revalidatePath("/agenda/novo");
    return undefined;
  });
}

/**
 * Deletes a service outright when it's safe to (no appointment ever
 * referenced it — appointments.service_id is ON DELETE RESTRICT, by
 * design, so appointment history can never silently disappear). When
 * that FK blocks the delete, falls back to the existing soft-delete
 * (active = false) instead of surfacing a confusing database error —
 * from the owner's point of view the service is gone from their
 * catalogue either way.
 */
export async function deleteService(
  serviceId: string,
): Promise<ActionResult<{ fullyDeleted: boolean }>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const { error: deleteError } = await supabase
      .from("services")
      .delete()
      .eq("id", serviceId);

    if (!deleteError) {
      revalidatePath("/servicos");
      revalidatePath("/agenda/novo");
      return { fullyDeleted: true };
    }

    if (deleteError.code !== "23503") throw deleteError;

    const { error: deactivateError } = await supabase
      .from("services")
      .update({ active: false })
      .eq("id", serviceId);
    if (deactivateError) throw deactivateError;

    revalidatePath("/servicos");
    revalidatePath("/agenda/novo");
    return { fullyDeleted: false };
  });
}
