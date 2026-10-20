import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminPageClient } from "@/components/admin/AdminPageClient";
import { NotPlatformAdminError, requirePlatformAdmin } from "@/lib/supabase/current-user";
import {
  getAdminAuditLog,
  getAdminMetrics,
  getAdminOverview,
  getAdminPlans,
  getAdminRevenueTimeseries,
  getPixPaymentSettings,
  type PixPaymentSettings,
} from "@/lib/actions/admin";

export const metadata: Metadata = { title: "Administração — Easy Barber" };

const EMPTY_METRICS = {
  total_companies: 0,
  active_companies: 0,
  mrr_cents: 0,
  new_companies_this_month: 0,
  total_appointments: 0,
  appointments_this_month: 0,
  total_whatsapp_messages: 0,
  whatsapp_cost_cents_this_month: 0,
};

export default async function AdminPage() {
  // The sidebar only *shows* this link to a platform admin — that's a
  // UI affordance, not access control. A regular barbershop owner who
  // still has a company_members row passes the shared (app)/layout.tsx
  // check fine (it only blocks someone with no session or no company
  // at all), so this page needs its own real guard, same as every
  // admin_* database function independently re-checks
  // is_platform_admin() rather than trusting this one either.
  try {
    await requirePlatformAdmin();
  } catch (error) {
    if (error instanceof NotPlatformAdminError) {
      redirect("/dashboard");
    }
    throw error;
  }

  const [overview, metrics, revenue, plans, auditLog, pixSettings] = await Promise.all([
    getAdminOverview(),
    getAdminMetrics(),
    getAdminRevenueTimeseries(12),
    getAdminPlans(),
    getAdminAuditLog(20),
    getPixPaymentSettings(),
  ]);

  const EMPTY_PIX_SETTINGS: PixPaymentSettings = { pixKey: null, qrCodeUrl: null };

  return (
    <AdminPageClient
      companies={overview.ok ? overview.data : []}
      metrics={metrics.ok ? metrics.data : EMPTY_METRICS}
      revenue={revenue.ok ? revenue.data : []}
      plans={plans.ok ? plans.data : []}
      auditLog={auditLog.ok ? auditLog.data : []}
      pixSettings={pixSettings.ok ? pixSettings.data : EMPTY_PIX_SETTINGS}
    />
  );
}
