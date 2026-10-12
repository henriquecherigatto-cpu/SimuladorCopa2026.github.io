"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";
import { createCustomer } from "@/lib/actions/customers";

export interface CreateAppointmentInput {
  customerId?: string;
  newCustomer?: { name: string; phone: string };
  serviceId: string;
  professionalId: string;
  date: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  notes?: string;
}

export interface AvailableSlotsResult {
  slots: string[];
}

/**
 * Server-side source of truth for what's bookable — calls the same
 * get_available_slots() Postgres function the exclusion constraint
 * and business-hours trigger are built on, so a slot offered here is
 * actually insertable. The client must never compute this itself.
 */
export async function fetchAvailableSlots(input: {
  professionalId: string;
  serviceId: string;
  date: string;
}): Promise<ActionResult<AvailableSlotsResult>> {
  return runAction(async () => {
    const { supabase, companyId } = await requireMembership();

    if (!input.professionalId || !input.serviceId || !input.date) {
      return { slots: [] };
    }

    const { data, error } = await supabase.rpc("get_available_slots", {
      p_company_id: companyId,
      p_professional_id: input.professionalId,
      p_service_id: input.serviceId,
      p_date: input.date,
    });

    if (error) throw error;
    return { slots: (data ?? []).map((row) => row.slot_start.slice(0, 5)) };
  });
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { supabase, companyId, userId, role } = await requireMembership();

    if (role !== "owner" && role !== "professional") {
      throw new Error("Você não tem permissão para criar agendamentos.");
    }
    if (!input.serviceId) throw new Error("Selecione um serviço.");
    if (!input.professionalId) throw new Error("Selecione um profissional.");
    if (!input.date || !input.startTime) {
      throw new Error("Selecione data e horário.");
    }

    let customerId = input.customerId;
    if (!customerId) {
      if (!input.newCustomer?.name?.trim() || !input.newCustomer?.phone?.trim()) {
        throw new Error("Informe nome e telefone do novo cliente.");
      }
      const customerResult = await createCustomer({
        name: input.newCustomer.name,
        phone: input.newCustomer.phone,
      });
      if (!customerResult.ok) throw new Error(customerResult.error);
      customerId = customerResult.data.id;
    }

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("duration_min")
      .eq("id", input.serviceId)
      .eq("company_id", companyId)
      .single();
    if (serviceError || !service) {
      throw new Error("Serviço inválido para esta barbearia.");
    }

    const startsAt = new Date(`${input.date}T${input.startTime}:00`);
    const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        company_id: companyId,
        customer_id: customerId,
        professional_id: input.professionalId,
        service_id: input.serviceId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        notes: input.notes?.trim() || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/agenda");
    revalidatePath("/dashboard");
    return data;
  });
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "agendado" | "confirmado" | "concluido" | "cancelado",
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase } = await requireMembership();

    const { error, count } = await supabase
      .from("appointments")
      .update({ status }, { count: "exact" })
      .eq("id", appointmentId);

    if (error) throw error;
    if (!count) {
      throw new Error("Agendamento não encontrado ou sem permissão para alterá-lo.");
    }

    revalidatePath("/agenda");
    revalidatePath("/dashboard");
    return undefined;
  });
}

export async function cancelAppointment(
  appointmentId: string,
): Promise<ActionResult<undefined>> {
  return updateAppointmentStatus(appointmentId, "cancelado");
}

export interface AppointmentListItem {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "agendado" | "confirmado" | "concluido" | "cancelado";
  notes: string | null;
  customer: { id: string; name: string; phone: string } | null;
  service: { id: string; name: string; price_cents: number } | null;
  professional: { id: string; name: string; color: string } | null;
}

/**
 * Appointments within [startDate, endDate] (inclusive, company-local
 * calendar days). RLS already scopes this to the caller's company —
 * and, for a professional (not owner), to their own appointments only
 * — so no extra filtering is needed here.
 */
export async function listAppointmentsInRange(
  startDate: string,
  endDate: string,
): Promise<ActionResult<AppointmentListItem[]>> {
  return runAction(async () => {
    const { supabase, companyId } = await requireMembership();

    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, notes, customer:customers!appointments_customer_id_fkey(id,name,phone), service:services!appointments_service_id_fkey(id,name,price_cents), professional:professionals!appointments_professional_id_fkey(id,name,color)",
      )
      .eq("company_id", companyId)
      .gte("starts_at", `${startDate}T00:00:00Z`)
      .lt("starts_at", `${endDate}T23:59:59.999Z`)
      .order("starts_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  });
}
