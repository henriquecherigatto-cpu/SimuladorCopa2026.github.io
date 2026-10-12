"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";
import type { Database } from "@/lib/supabase/database.types";

export interface CustomerInput {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

function assertCanWrite(role: string) {
  if (role !== "owner" && role !== "professional") {
    throw new Error("Você não tem permissão para gerenciar clientes.");
  }
}

export async function createCustomer(
  input: CustomerInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertCanWrite(role);

    if (!input.name.trim()) throw new Error("Informe o nome do cliente.");
    if (!input.phone.trim()) throw new Error("Informe o telefone do cliente.");

    const { data, error } = await supabase
      .from("customers")
      .insert({
        company_id: companyId,
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/clientes");
    revalidatePath("/agenda/novo");
    return data;
  });
}

export async function updateCustomer(
  customerId: string,
  input: Partial<CustomerInput>,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, role } = await requireMembership();
    assertCanWrite(role);

    const patch: Database["public"]["Tables"]["customers"]["Update"] = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.phone !== undefined) patch.phone = input.phone.trim();
    if (input.email !== undefined) patch.email = input.email.trim() || null;
    if (input.notes !== undefined) patch.notes = input.notes.trim() || null;

    const { error } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", customerId);

    if (error) throw error;
    revalidatePath("/clientes");
    revalidatePath("/agenda/novo");
    return undefined;
  });
}

export interface CustomerAppointmentHistoryItem {
  id: string;
  starts_at: string;
  status: string;
  service: { name: string } | null;
  professional: { name: string } | null;
}

export async function getCustomerAppointmentHistory(
  customerId: string,
): Promise<ActionResult<CustomerAppointmentHistoryItem[]>> {
  return runAction(async () => {
    const { supabase } = await requireMembership();

    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, starts_at, status, service:services!appointments_service_id_fkey(name), professional:professionals!appointments_professional_id_fkey(name)",
      )
      .eq("customer_id", customerId)
      .order("starts_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return data ?? [];
  });
}
