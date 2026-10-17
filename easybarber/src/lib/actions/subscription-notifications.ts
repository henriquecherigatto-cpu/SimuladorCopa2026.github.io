import "server-only";
import { differenceInCalendarDays, format } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { todayInAppTimezone } from "@/lib/utils";

/**
 * Sent once, at the moment sweep_subscription_lifecycle() moves a
 * subscription ativa -> tolerancia (the only caller is
 * src/app/api/billing/sweep/route.ts, right after that RPC call) —
 * not every day of the grace period, just the one notification that
 * the clock has started. Needs its own approved Meta message template
 * named "subscription_grace_reminder" (distinct from the booking
 * confirmation's "booking_confirmation") — see
 * docs/whatsapp-integration.md.
 *
 * Goes to the BARBERSHOP's own number (companies.whatsapp_number —
 * the same field the public booking page's "Falar no WhatsApp" button
 * uses), not to the platform's support line and not to any customer.
 */
export async function notifyCompanyEnteringGracePeriod(companyId: string): Promise<void> {
  const provider = await getWhatsAppProvider(companyId);
  if (!provider.isConfigured("subscription_grace_reminder")) return;

  const supabase = createServiceRoleClient();

  const [{ data: company }, { data: subscription }] = await Promise.all([
    supabase.from("companies").select("name, whatsapp_number").eq("id", companyId).single(),
    supabase
      .from("subscriptions")
      .select("grace_period_ends_at")
      .eq("company_id", companyId)
      .single(),
  ]);

  if (!company?.whatsapp_number || !subscription?.grace_period_ends_at) return;

  const blockDate = new Date(`${subscription.grace_period_ends_at}T00:00:00`);
  const daysRemaining = differenceInCalendarDays(blockDate, todayInAppTimezone());
  if (daysRemaining < 0) return;

  const result = await provider.sendMessage({
    to: company.whatsapp_number,
    template: "subscription_grace_reminder",
    templateVariables: {
      "1": company.name,
      "2": String(daysRemaining),
      "3": format(blockDate, "dd/MM/yyyy"),
    },
  });

  if (!result.ok) {
    console.error(`WhatsApp grace-period reminder send failed (${provider.name}):`, result.error);
    // Same understandable-status reasoning as sendBookingConfirmation()
    // — surfaces the failure in Configurações, isolated in its own
    // try/catch so it can never skip the log_whatsapp_message() call below.
    try {
      await supabase.rpc("set_whatsapp_connection_error", {
        p_company_id: companyId,
        p_error: result.error ?? "Falha ao enviar lembrete de carência por WhatsApp.",
      });
    } catch (error) {
      console.error("Failed to record the WhatsApp connection error:", error);
    }
  }

  // Same best-effort admin-dashboard bookkeeping as
  // sendBookingConfirmation() — a logging failure must never surface
  // as a sweep failure. No appointment behind this send, so
  // p_company_id (not p_appointment_id) is what tells
  // log_whatsapp_message() which company to attribute it to — see
  // 20260101000026_whatsapp_plan_gating_and_subscription_alerts.sql.
  try {
    await supabase.rpc("log_whatsapp_message", {
      p_status: result.ok ? "sent" : "failed",
      p_provider: provider.name,
      p_company_id: companyId,
      p_provider_message_id: result.ok ? result.providerMessageId : undefined,
      p_error: result.ok ? undefined : result.error,
      p_template: "subscription_grace_reminder",
    });
  } catch (error) {
    console.error(
      "Failed to log WhatsApp grace-period reminder for the admin dashboard:",
      error,
    );
  }
}
