import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HorariosOnboardingClient } from "@/components/onboarding/HorariosOnboardingClient";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAY_LABELS } from "@/lib/utils";
import { onboardingStepRoute } from "@/lib/onboarding";
import type { BusinessHours } from "@/types";

export const metadata: Metadata = { title: "Horário de funcionamento — Easy Barber" };

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function toDisplayHours(
  rows: { day_of_week: number; is_open: boolean; start_time: string; end_time: string }[],
): BusinessHours[] {
  return DISPLAY_ORDER.map((dayOfWeek) => {
    const row = rows.find((r) => r.day_of_week === dayOfWeek);
    return {
      day: WEEKDAY_LABELS[dayOfWeek],
      open: row?.is_open ?? false,
      start: (row?.start_time ?? "08:00").slice(0, 5),
      end: (row?.end_time ?? "18:00").slice(0, 5),
    };
  });
}

export default async function OnboardingHorariosPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: membership } = await supabase
    .from("company_members")
    .select("role, company_id")
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding/empresa");
  // Same structural guarantee relied on throughout onboarding: a
  // professional can't exist yet for a company that hasn't cleared
  // every mandatory step — see (app)/layout.tsx.
  if (membership.role !== "owner") redirect("/dashboard");

  const { data: company } = await supabase
    .from("companies")
    .select("onboarding_step")
    .eq("id", membership.company_id)
    .single();

  if (company && company.onboarding_step !== 0) {
    redirect(onboardingStepRoute(company.onboarding_step));
  }

  const { data: hoursRows } = await supabase
    .from("business_hours")
    .select("day_of_week, is_open, start_time, end_time")
    .eq("company_id", membership.company_id)
    .order("day_of_week", { ascending: true });

  return <HorariosOnboardingClient initialHours={toDisplayHours(hoursRows ?? [])} />;
}
