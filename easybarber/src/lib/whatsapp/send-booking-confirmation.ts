import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { APP_TIMEZONE } from "@/lib/utils";
import type { PublicBookingResult } from "@/lib/actions/public-booking";

/**
 * Plain (non-"use server") module, deliberately: createPublicBooking()
 * in src/lib/actions/public-booking.ts is the only caller, and this
 * function must NEVER be independently reachable as its own Server
 * Action (every export from a "use server" file becomes one) — it has
 * no auth boundary of its own beyond the checks below, all of which
 * derive from the server-trusted appointment id, never from a second,
 * independently-spoofable parameter.
 *
 * The variable order here (1..5) must match the approved WhatsApp
 * Content Template's own {{1}}..{{5}} placeholders exactly — see
 * docs/whatsapp-integration.md for the template text this is built
 * for. Changing one side without the other either sends the wrong
 * values into the right slots, or fails outright.
 */
export async function sendBookingConfirmation(
  customerPhone: string,
  booking: PublicBookingResult,
): Promise<void> {
  if (!booking.found || !booking.startsAt) return;

  const serviceRoleClient = createServiceRoleClient();

  // The automated confirmation is a Profissional-tier (R$49,90) perk,
  // available only while the subscription is actually ativa — not just
  // on the right plan, so a pendente/tolerancia/suspensa/cancelada
  // company never gets a message either, even if it's Profissional.
  // See whatsapp_confirmation_allowed() in
  // 20260101000034_whatsapp_confirmation_subscription_gate.sql, which
  // derives company_id from the (server-trusted) appointment id itself
  // rather than trusting a second, independently-spoofable parameter.
  // subscriptions/plans are owner-only under RLS (subscriptions_select),
  // so this needs the service-role client — the visitor's own booking
  // session has no read access to them. Any failure here — a thrown
  // error, or the RPC returning anything but exactly `true` — must
  // deny the send, never allow it by default.
  const { data: eligible, error: eligibilityError } = await serviceRoleClient.rpc(
    "whatsapp_confirmation_allowed",
    { p_appointment_id: booking.id },
  );
  if (eligibilityError || eligible !== true) return;

  const { data: appointment, error: appointmentError } = await serviceRoleClient
    .from("appointments")
    .select("company_id, customer_id")
    .eq("id", booking.id)
    .single();
  if (appointmentError || !appointment) return;

  // The customer's own opt-out — "não autorizou" means "don't send",
  // independent of the company's plan/subscription.
  const { data: customer, error: customerError } = await serviceRoleClient
    .from("customers")
    .select("whatsapp_opt_out")
    .eq("id", appointment.customer_id)
    .single();
  if (customerError || !customer || customer.whatsapp_opt_out) return;

  // Duplicate-send guard (retries, duplicate events): if a
  // booking_confirmation for this exact appointment already went out
  // (sent/delivered/read — anything but a known failure), don't send
  // it again. Checked AFTER eligibility/opt-out so an ineligible
  // company's appointment never even reaches this query.
  const { data: existing } = await serviceRoleClient
    .from("whatsapp_messages")
    .select("id")
    .eq("appointment_id", booking.id)
    .eq("template", "booking_confirmation")
    .neq("status", "failed")
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const provider = await getWhatsAppProvider(appointment.company_id);
  if (!provider.isConfigured("booking_confirmation")) return;

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
    // Surfaces the failure in Configurações (not just server logs) —
    // same understandable-status requirement the test-send button
    // satisfies for a manual check, here for a real send that failed
    // on its own. Never tears down the stored connection itself (that
    // is clear_whatsapp_connection()'s job, triggered only by the
    // owner) — just records the most recent error. Isolated in its
    // own try/catch so a failure here can never skip the
    // log_whatsapp_message() call below.
    try {
      await serviceRoleClient.rpc("set_whatsapp_connection_error", {
        p_company_id: appointment.company_id,
        p_error: result.error ?? "Falha ao enviar confirmação por WhatsApp.",
      });
    } catch (error) {
      console.error("Failed to record the WhatsApp connection error:", error);
    }
  }

  // Best-effort bookkeeping for the admin dashboard (how many
  // messages each company sends, and their cost) AND the webhook's
  // later delivery-status updates (matched by provider_message_id —
  // see update_whatsapp_message_status() in
  // 20260101000036_whatsapp_cloud_api_schema.sql). A logging failure
  // must never surface as a booking error, same as the send itself.
  try {
    await serviceRoleClient.rpc("log_whatsapp_message", {
      p_appointment_id: booking.id,
      p_status: result.ok ? "sent" : "failed",
      p_provider: provider.name,
      p_provider_message_id: result.ok ? result.providerMessageId : undefined,
      p_error: result.ok ? undefined : result.error,
      p_template: "booking_confirmation",
    });
  } catch (error) {
    console.error("Failed to log WhatsApp message for the admin dashboard:", error);
  }
}
