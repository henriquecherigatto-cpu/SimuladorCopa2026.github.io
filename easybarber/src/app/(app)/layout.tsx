import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import type { SubscriptionAlert } from "@/components/layout/SubscriptionStatusModal";
import { createClient } from "@/lib/supabase/server";
import { onboardingStepRoute } from "@/lib/onboarding";
import { todayInAppTimezone } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  professional: "Profissional",
};

export default async function AppGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  // Secure check (not just the optimistic one in src/proxy.ts): every
  // query below also goes through the real RLS policies, but we still
  // want a clean redirect instead of an empty/broken page if someone
  // reaches this layout without a session.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, is_platform_admin")
      .eq("id", userId)
      .single(),
    supabase
      .from("company_members")
      .select("role, company_id, companies ( name )")
      .eq("profile_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);

  const isPlatformAdmin = profile?.is_platform_admin ?? false;

  // Every non-admin user needs a company to do anything in this app —
  // send them to finish signing up their barbearia. An admin with no
  // company of their own is fine (they only need /admin).
  if (!membership && !isPlatformAdmin) {
    redirect("/onboarding/empresa");
  }

  // Billing status is only visible to an owner (subscriptions_select
  // RLS policy denies it to a professional and to a bare platform
  // admin with no company), and only an owner can act on it — a
  // professional has no reason to see a payment warning they can't
  // do anything about. In practice this also means a 'pendente'
  // company (or one still mid-onboarding, below) can only ever be
  // caught here for its owner: a professional member can't exist yet
  // for a company that hasn't gotten past every gate below (adding
  // one happens from inside the app, which this gate blocks until
  // onboarding_step reaches 3).
  let subscriptionAlert: SubscriptionAlert | null = null;
  if (membership?.role === "owner") {
    const [{ data: subscription }, { data: company }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("status, grace_period_ends_at")
        .eq("company_id", membership.company_id)
        .maybeSingle(),
      supabase
        .from("companies")
        .select("onboarding_step")
        .eq("id", membership.company_id)
        .single(),
    ]);

    // 'pendente' means the first payment was never completed — unlike
    // 'tolerancia'/'suspensa' below, access was never actually granted
    // in the first place, so this redirects away from the whole app
    // shell instead of just showing a banner. See
    // /onboarding/pagamento for the checkout UI.
    if (subscription?.status === "pendente") {
      redirect("/onboarding/pagamento");
    }

    // Past payment, still short of horários/serviços/profissionais —
    // a ONE-TIME gate (see 20260101000038_onboarding_steps.sql):
    // never re-checked once onboarding_step reaches 3, even if the
    // company later has zero services again (e.g. reorganizing its
    // catalog during normal operation).
    if (company && company.onboarding_step < 3) {
      redirect(onboardingStepRoute(company.onboarding_step));
    }

    if (subscription?.status === "suspensa") {
      subscriptionAlert = { variant: "suspended" };
    } else if (subscription?.status === "tolerancia" && subscription.grace_period_ends_at) {
      const blockDate = new Date(`${subscription.grace_period_ends_at}T00:00:00`);
      const daysRemaining = differenceInCalendarDays(blockDate, todayInAppTimezone());
      if (daysRemaining >= 0) {
        subscriptionAlert = {
          variant: "grace",
          daysRemaining,
          blockDateLabel: format(blockDate, "dd/MM/yyyy"),
        };
      }
    }
  }

  const identity = {
    userName: profile?.full_name || profile?.email || "Usuário",
    companyName: membership?.companies?.name ?? null,
    roleLabel: membership
      ? (ROLE_LABELS[membership.role] ?? membership.role)
      : "Administrador da plataforma",
    isPlatformAdmin,
  };

  return (
    <AppShell identity={identity} subscriptionAlert={subscriptionAlert}>
      {children}
    </AppShell>
  );
}
