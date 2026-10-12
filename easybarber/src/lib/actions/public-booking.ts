"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/action-result";

/**
 * The public, no-login booking flow (/agendar/<slug>). Every call
 * here goes through a Supabase client with whatever session (or lack
 * of one) the visitor's browser actually has — there is no
 * requireMembership() gate, by design: this is the one part of the
 * app meant to work for a stranger with no account.
 *
 * None of these functions decide what's safe to expose or writable —
 * that's entirely the job of the three Postgres functions they call
 * (get_public_booking_page / get_public_available_slots /
 * create_public_appointment, see
 * supabase/migrations/20260101000018_public_booking.sql), which are
 * the only things granted to the `anon` role. This file is just a
 * thin, friendly-error-message wrapper around them.
 */

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
}

export interface PublicProfessional {
  id: string;
  name: string;
  color: string;
  service_ids: string[];
}

export interface PublicBookingPage {
  company: { id: string; name: string; address: string | null; phone: string } | null;
  services: PublicService[];
  professionals: PublicProfessional[];
}

function friendlyPublicError(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code === "23P01") {
    return "Esse horário acabou de deixar de estar disponível. Escolha outro horário.";
  }
  if (message.includes("business hours")) {
    return "A barbearia está fechada nesse horário.";
  }
  if (message.includes("blocked interval")) {
    return "Esse horário não está disponível.";
  }
  if (message.includes("does not perform the selected service")) {
    return "Este profissional não realiza o serviço selecionado.";
  }
  if (message.includes("is not available")) {
    return "Essa opção não está mais disponível. Atualize a página e tente novamente.";
  }
  if (message.includes("in the past")) {
    return "Não é possível agendar em uma data que já passou.";
  }
  if (message.includes("name is required")) {
    return "Informe seu nome.";
  }
  if (message.includes("phone is required")) {
    return "Informe seu telefone.";
  }
  if (message.includes("not found")) {
    return "Barbearia não encontrada.";
  }
  return "Não foi possível concluir o agendamento. Tente novamente em instantes.";
}

export async function getPublicBookingPage(slug: string): Promise<ActionResult<PublicBookingPage>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_booking_page", { p_slug: slug });
    if (error) throw error;

    const page = (data ?? {}) as Partial<PublicBookingPage>;
    return {
      ok: true,
      data: {
        company: page.company ?? null,
        services: page.services ?? [],
        professionals: page.professionals ?? [],
      },
    };
  } catch (error) {
    return { ok: false, error: friendlyPublicError(error) };
  }
}

export async function fetchPublicAvailableSlots(input: {
  slug: string;
  professionalId: string;
  serviceId: string;
  date: string;
}): Promise<ActionResult<{ slots: string[] }>> {
  try {
    if (!input.professionalId || !input.serviceId || !input.date) {
      return { ok: true, data: { slots: [] } };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_available_slots", {
      p_slug: input.slug,
      p_professional_id: input.professionalId,
      p_service_id: input.serviceId,
      p_date: input.date,
    });
    if (error) throw error;

    return { ok: true, data: { slots: (data ?? []).map((row) => row.slot_start.slice(0, 5)) } };
  } catch (error) {
    return { ok: false, error: friendlyPublicError(error) };
  }
}

export interface CreatePublicBookingInput {
  slug: string;
  serviceId: string;
  professionalId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
}

export async function createPublicBooking(
  input: CreatePublicBookingInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!input.customerName.trim()) throw new Error("name is required");
    if (!input.customerPhone.trim()) throw new Error("phone is required");
    if (!input.serviceId || !input.professionalId || !input.date || !input.startTime) {
      throw new Error("Selecione serviço, profissional, data e horário.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_public_appointment", {
      p_slug: input.slug,
      p_service_id: input.serviceId,
      p_professional_id: input.professionalId,
      p_date: input.date,
      p_start_time: input.startTime,
      p_customer_name: input.customerName.trim(),
      p_customer_phone: input.customerPhone.trim(),
      p_customer_email: input.customerEmail?.trim() || undefined,
      p_notes: input.notes?.trim() || undefined,
    });
    if (error) throw error;

    return { ok: true, data: { id: data as string } };
  } catch (error) {
    return { ok: false, error: friendlyPublicError(error) };
  }
}
