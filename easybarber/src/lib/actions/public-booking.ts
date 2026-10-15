"use server";

import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ActionResult } from "@/lib/actions/action-result";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { APP_TIMEZONE } from "@/lib/utils";

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
  photo_url: string | null;
  service_ids: string[];
}

export interface PublicBookingPage {
  company: {
    id: string;
    name: string;
    address: string | null;
    phone: string;
    whatsapp_number: string;
  } | null;
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

export interface PublicCustomerAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "agendado" | "confirmado" | "concluido" | "cancelado";
  service_name: string;
  professional_name: string;
}

/**
 * "Consultar meu agendamento" — a visitor looks up their own bookings
 * by phone number, no login. Scoped to one company via the slug;
 * get_public_customer_appointments() never returns another company's
 * appointments even if the same phone belongs to a customer there too.
 */
export async function fetchPublicCustomerAppointments(input: {
  slug: string;
  phone: string;
}): Promise<ActionResult<PublicCustomerAppointment[]>> {
  try {
    if (!input.phone.trim()) {
      return { ok: true, data: [] };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_customer_appointments", {
      p_slug: input.slug,
      p_phone: input.phone.trim(),
    });
    if (error) throw error;

    return { ok: true, data: data ?? [] };
  } catch (error) {
    return { ok: false, error: friendlyPublicError(error) };
  }
}

export interface PublicBookingResult extends PublicAppointmentSummary {
  id: string;
  cancelToken: string;
}

export async function createPublicBooking(
  input: CreatePublicBookingInput,
): Promise<ActionResult<PublicBookingResult>> {
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

    // create_public_appointment() returns id/cancel_token merged with
    // the same display fields get_public_appointment_by_token() would
    // return for that token — toAppointmentSummary() picks those out,
    // so the confirmation message is built from server-confirmed data
    // (see sendBookingConfirmation()), never client-held form state.
    const raw = data as { id: string; cancel_token: string };
    const result: PublicBookingResult = {
      id: raw.id,
      cancelToken: raw.cancel_token,
      ...toAppointmentSummary(data),
    };

    // Best-effort: a WhatsApp delivery failure (no credentials
    // configured yet, the provider is down, an invalid number) must
    // never undo a booking that already succeeded in the database.
    // The customer still gets their confirmation on the success
    // screen either way — this is a courtesy on top of that, not the
    // source of truth.
    await sendBookingConfirmation(input.customerPhone, result).catch((error) => {
      console.error("Failed to send WhatsApp booking confirmation:", error);
    });

    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: friendlyPublicError(error) };
  }
}

/**
 * The variable order here (1..5) must match the approved WhatsApp
 * Content Template's own {{1}}..{{5}} placeholders exactly — see
 * docs/whatsapp-integration.md for the template text this is built
 * for. Changing one side without the other either sends the wrong
 * values into the right slots, or fails outright.
 */
async function sendBookingConfirmation(
  customerPhone: string,
  booking: PublicBookingResult,
): Promise<void> {
  const provider = getWhatsAppProvider();
  if (!provider.isConfigured("booking_confirmation")) return;
  if (!booking.found || !booking.startsAt) return;

  // The automated confirmation is a Profissional-tier (R$49,90) perk,
  // not included on Essencial — see
  // 20260101000026_whatsapp_plan_gating_and_subscription_alerts.sql.
  // subscriptions/plans are owner-only under RLS (subscriptions_select),
  // so this check needs the service-role client — the visitor booking
  // has no session that could read it.
  const serviceRoleClient = createServiceRoleClient();

  const { data: appointment } = await serviceRoleClient
    .from("appointments")
    .select("company_id")
    .eq("id", booking.id)
    .single();
  if (!appointment) return;

  const { data: subscription } = await serviceRoleClient
    .from("subscriptions")
    .select("plans ( whatsapp_confirmations_included )")
    .eq("company_id", appointment.company_id)
    .single();
  if (!subscription?.plans?.whatsapp_confirmations_included) return;

  const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cancelar/${booking.cancelToken}`;

  // formatInTimeZone (not a bare format(new Date(...))) because this
  // runs on the server, whose own local timezone (UTC on Vercel) has
  // nothing to do with the customer's — see
  // supabase/migrations/20260101000022_fix_appointment_timezone.sql
  // for the same mistake made on the storage side.
  const result = await provider.sendMessage({
    to: customerPhone,
    template: "booking_confirmation",
    templateVariables: {
      "1": booking.companyName ?? "",
      "2": booking.serviceName ?? "",
      "3": booking.professionalName ?? "",
      "4": formatInTimeZone(booking.startsAt, APP_TIMEZONE, "EEEE, d 'de' MMMM 'às' HH:mm", {
        locale: ptBR,
      }),
      "5": cancelUrl,
    },
  });
  if (!result.ok) {
    console.error(`WhatsApp confirmation send failed (${provider.name}):`, result.error);
  }

  // Best-effort bookkeeping for the admin dashboard (how many
  // messages each company sends, and their cost) — log_whatsapp_message()
  // is service_role-only (see 20260101000023_admin_analytics.sql), so
  // this needs the service-role client even though the booking itself
  // ran under the visitor's own anon session. A logging failure must
  // never surface as a booking error, same as the send itself. Reuses
  // the same serviceRoleClient created above for the plan check.
  try {
    await serviceRoleClient.rpc("log_whatsapp_message", {
      p_appointment_id: booking.id,
      p_status: result.ok ? "sent" : "failed",
      p_provider: provider.name,
      p_provider_message_id: result.ok ? result.providerMessageId : undefined,
      p_error: result.ok ? undefined : result.error,
    });
  } catch (error) {
    console.error("Failed to log WhatsApp message for the admin dashboard:", error);
  }
}

export interface PublicAppointmentSummary {
  found: boolean;
  companyName?: string;
  serviceName?: string;
  professionalName?: string;
  startsAt?: string;
  status?: "agendado" | "confirmado" | "concluido" | "cancelado";
  canCancel?: boolean;
}

function toAppointmentSummary(raw: unknown): PublicAppointmentSummary {
  const r = (raw ?? {}) as Partial<{
    found: boolean;
    company_name: string;
    service_name: string;
    professional_name: PublicAppointmentSummary["status"];
    starts_at: string;
    status: PublicAppointmentSummary["status"];
    can_cancel: boolean;
  }>;
  if (!r.found) return { found: false };
  return {
    found: true,
    companyName: r.company_name,
    serviceName: r.service_name,
    professionalName: r.professional_name as string | undefined,
    startsAt: r.starts_at,
    status: r.status,
    canCancel: r.can_cancel,
  };
}

/**
 * Read-only: safe to call on a bare page visit (e.g. a messaging
 * app's link-preview bot hitting the cancel link before a human
 * does) since it never changes anything. A malformed or unknown
 * token both just come back as { found: false } — never an error —
 * so the cancel page can't be used to probe which tokens are real.
 */
export async function getPublicAppointmentByToken(
  token: string,
): Promise<ActionResult<PublicAppointmentSummary>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_appointment_by_token", {
      p_token: token,
    });
    if (error) throw error;
    return { ok: true, data: toAppointmentSummary(data) };
  } catch {
    return { ok: true, data: { found: false } };
  }
}

/**
 * The only way an anonymous visitor can cancel their own appointment
 * — only ever called from an explicit button click (see
 * CancelAppointmentClient), never on page load.
 */
export async function cancelPublicAppointment(
  token: string,
): Promise<ActionResult<PublicAppointmentSummary>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancel_appointment_by_token", {
      p_token: token,
    });
    if (error) throw error;
    return { ok: true, data: toAppointmentSummary(data) };
  } catch {
    return { ok: true, data: { found: false } };
  }
}
