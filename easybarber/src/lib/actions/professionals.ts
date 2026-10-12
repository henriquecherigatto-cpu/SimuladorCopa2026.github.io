"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";
import type { Database } from "@/lib/supabase/database.types";

export interface ProfessionalInput {
  name: string;
  phone?: string;
  roleTitle?: string;
  color?: string;
  serviceIds: string[];
}

function assertOwner(role: string) {
  if (role !== "owner") {
    throw new Error("Apenas o proprietário pode gerenciar profissionais.");
  }
}

export async function createProfessional(
  input: ProfessionalInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    if (!input.name.trim()) throw new Error("Informe o nome do profissional.");

    const { data, error } = await supabase
      .from("professionals")
      .insert({
        company_id: companyId,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        role_title: input.roleTitle?.trim() || "Barbeiro",
        color: input.color || "#FF6B1A",
      })
      .select("id")
      .single();

    if (error) throw error;

    if (input.serviceIds.length > 0) {
      const { error: linkError } = await supabase
        .from("professional_services")
        .insert(input.serviceIds.map((serviceId) => ({
          professional_id: data.id,
          service_id: serviceId,
        })));
      if (linkError) throw linkError;
    }

    revalidatePath("/profissionais");
    revalidatePath("/agenda/novo");
    return data;
  });
}

export async function updateProfessional(
  professionalId: string,
  input: Partial<Omit<ProfessionalInput, "serviceIds">> & {
    weeklyDaysOff?: number[];
    workStart?: string;
    workEnd?: string;
  },
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const patch: Database["public"]["Tables"]["professionals"]["Update"] = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
    if (input.roleTitle !== undefined) patch.role_title = input.roleTitle.trim();
    if (input.weeklyDaysOff !== undefined) patch.weekly_days_off = input.weeklyDaysOff;
    if (input.workStart !== undefined) patch.work_start = input.workStart;
    if (input.workEnd !== undefined) patch.work_end = input.workEnd;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("professionals")
        .update(patch)
        .eq("id", professionalId);
      if (error) throw error;
    }

    revalidatePath("/profissionais");
    revalidatePath("/agenda/novo");
    return undefined;
  });
}

export async function setProfessionalServices(
  professionalId: string,
  serviceIds: string[],
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const { error: deleteError } = await supabase
      .from("professional_services")
      .delete()
      .eq("professional_id", professionalId);
    if (deleteError) throw deleteError;

    if (serviceIds.length > 0) {
      const { error: insertError } = await supabase
        .from("professional_services")
        .insert(serviceIds.map((serviceId) => ({
          professional_id: professionalId,
          service_id: serviceId,
        })));
      if (insertError) throw insertError;
    }

    revalidatePath("/profissionais");
    revalidatePath("/agenda/novo");
    return undefined;
  });
}

export async function setProfessionalActive(
  professionalId: string,
  active: boolean,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertOwner(role);

    const { error } = await supabase
      .from("professionals")
      .update({ active })
      .eq("id", professionalId);

    if (error) throw error;
    revalidatePath("/profissionais");
    revalidatePath("/agenda/novo");
    return undefined;
  });
}
