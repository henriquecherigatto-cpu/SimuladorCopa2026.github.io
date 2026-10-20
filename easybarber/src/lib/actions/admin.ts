"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";

/**
 * The platform owner's own view — a third vantage point distinct from
 * a barbershop owner managing their company and a visitor booking
 * through the public page. Every function here is gated by
 * requirePlatformAdmin() AND backed by a database function that
 * independently re-checks is_platform_admin() itself (see
 * supabase/migrations/20260101000023_admin_analytics.sql) — the
 * client-side check is a fast fail, never the actual security
 * boundary. Nothing here ever returns a customer name, an
 * appointment's time, or a message's contents: every number is a
 * count or a sum, by the same design rule the rest of this schema's
 * admin-facing functions follow.
 */

export interface AdminCompanyRow {
  company_id: string;
  company_name: string;
  plan_id: string | null;
  plan_name: string | null;
  plan_price_cents: number | null;
  subscription_status: "ativa" | "pendente" | "tolerancia" | "suspensa" | "cancelada" | null;
  professional_count: number;
  customer_count: number;
  next_payment_date: string | null;
  appointment_count: number;
  appointments_this_month: number;
  whatsapp_message_count: number;
  whatsapp_messages_this_month: number;
  whatsapp_cost_cents: number;
}

export interface AdminPlatformMetrics {
  total_companies: number;
  active_companies: number;
  mrr_cents: number;
  new_companies_this_month: number;
  total_appointments: number;
  appointments_this_month: number;
  total_whatsapp_messages: number;
  whatsapp_cost_cents_this_month: number;
}

export interface AdminRevenuePoint {
  month: string;
  revenue_cents: number;
}

export interface AdminPlanRow {
  id: string;
  name: string;
  price_cents: number;
  max_professionals: number | null;
  max_customers: number | null;
  active: boolean;
}

export interface AdminAuditLogRow {
  id: string;
  action: string;
  target_type: string;
  company_id: string | null;
  metadata: unknown;
  created_at: string;
}

export async function getAdminOverview(): Promise<ActionResult<AdminCompanyRow[]>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const { data, error } = await supabase.rpc("admin_company_overview");
    if (error) throw error;
    return data ?? [];
  });
}

export async function getAdminMetrics(): Promise<ActionResult<AdminPlatformMetrics>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const { data, error } = await supabase.rpc("admin_platform_metrics");
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error("Não foi possível carregar as métricas da plataforma.");
    return row;
  });
}

export async function getAdminRevenueTimeseries(
  months = 12,
): Promise<ActionResult<AdminRevenuePoint[]>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const { data, error } = await supabase.rpc("admin_revenue_timeseries", { p_months: months });
    if (error) throw error;
    return data ?? [];
  });
}

export async function getAdminPlans(): Promise<ActionResult<AdminPlanRow[]>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, price_cents, max_professionals, max_customers, active")
      .order("price_cents", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
}

export async function getAdminAuditLog(limit = 20): Promise<ActionResult<AdminAuditLogRow[]>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, target_type, company_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  });
}

export async function updatePlanPrice(
  planId: string,
  priceCents: number,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      throw new Error("Informe um preço válido.");
    }

    const { error } = await supabase.rpc("admin_update_plan_price", {
      p_plan_id: planId,
      p_price_cents: Math.round(priceCents),
    });
    if (error) throw error;

    revalidatePath("/admin");
    return undefined;
  });
}

export async function updateSubscriptionStatus(
  companyId: string,
  status: "ativa" | "suspensa",
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();

    const { error, count } = await supabase
      .from("subscriptions")
      .update({ status }, { count: "exact" })
      .eq("company_id", companyId);
    if (error) throw error;
    if (!count) throw new Error("Assinatura não encontrada para esta empresa.");

    revalidatePath("/admin");
    return undefined;
  });
}

/**
 * Moves a company to a different plan (e.g. Essencial -> Profissional)
 * from the admin panel. See admin_update_company_plan() in
 * supabase/migrations/20260101000033_admin_plan_change.sql.
 */
export async function updateCompanyPlan(
  companyId: string,
  planId: string,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();

    const { error } = await supabase.rpc("admin_update_company_plan", {
      p_company_id: companyId,
      p_plan_id: planId,
    });
    if (error) throw error;

    revalidatePath("/admin");
    return undefined;
  });
}

/**
 * Manual override for a payment confirmed outside the automated flow
 * (Pix/WhatsApp, while real checkout isn't live) — extends the
 * company's paid-through date by `days` and marks it ativa again,
 * regardless of its current status. See admin_grant_subscription_access()
 * in supabase/migrations/20260101000025_admin_subscription_control.sql.
 */
export async function grantSubscriptionAccess(
  companyId: string,
  days: number,
): Promise<ActionResult<{ newPeriodEnd: string }>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new Error("Informe um número de dias entre 1 e 365.");
    }

    const { data, error } = await supabase.rpc("admin_grant_subscription_access", {
      p_company_id: companyId,
      p_days: days,
    });
    if (error) throw error;

    revalidatePath("/admin");
    return { newPeriodEnd: data as string };
  });
}

const PIX_QR_BUCKET = "pix-qr-code";
const MAX_QR_BYTES = 3 * 1024 * 1024;

function storagePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}

export interface PixPaymentSettings {
  pixKey: string | null;
  qrCodeUrl: string | null;
}

export async function getPixPaymentSettings(): Promise<ActionResult<PixPaymentSettings>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();
    const { data, error } = await supabase
      .from("pix_payment_settings")
      .select("pix_key, qr_code_url")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return { pixKey: data?.pix_key ?? null, qrCodeUrl: data?.qr_code_url ?? null };
  });
}

/**
 * The platform's single, fixed Pix receiving key + QR code — not
 * per-company, there's exactly one person receiving these payments.
 * Set here, shown on every company's /plano. See
 * admin_update_pix_settings() in
 * supabase/migrations/20260101000043_manual_pix_payment.sql. A new
 * image replaces the stored one (old object removed from storage);
 * omitting a file keeps whatever QR code is already set.
 */
export async function updatePixSettings(formData: FormData): Promise<ActionResult<PixPaymentSettings>> {
  return runAction(async () => {
    const { supabase } = await requirePlatformAdmin();

    const pixKeyRaw = formData.get("pixKey");
    const pixKey = typeof pixKeyRaw === "string" ? pixKeyRaw.trim() : "";

    const { data: current } = await supabase
      .from("pix_payment_settings")
      .select("qr_code_url")
      .eq("id", 1)
      .maybeSingle();

    let qrCodeUrl = current?.qr_code_url ?? null;

    const file = formData.get("qrCode");
    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/")) {
        throw new Error("Envie um arquivo de imagem (JPG, PNG, etc).");
      }
      if (file.size > MAX_QR_BYTES) {
        throw new Error("A imagem deve ter até 3 MB.");
      }

      const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(PIX_QR_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(PIX_QR_BUCKET).getPublicUrl(path);
      const previousPath = storagePathFromPublicUrl(qrCodeUrl, PIX_QR_BUCKET);
      qrCodeUrl = urlData.publicUrl;

      if (previousPath) {
        await supabase.storage.from(PIX_QR_BUCKET).remove([previousPath]);
      }
    }

    const { error } = await supabase.rpc("admin_update_pix_settings", {
      p_pix_key: pixKey,
      p_qr_code_url: qrCodeUrl ?? "",
    });
    if (error) throw error;

    revalidatePath("/admin");
    revalidatePath("/plano");

    return { pixKey: pixKey || null, qrCodeUrl };
  });
}
