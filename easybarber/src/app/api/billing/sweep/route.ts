import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * Triggers the date-driven half of the subscription state machine
 * (ativa → tolerancia once a due date passes, tolerancia → suspensa
 * once the 10-day grace period runs out — see
 * supabase/migrations/20260101000017_subscription_lifecycle.sql).
 * Nothing announces these transitions on its own; something has to
 * check the clock. In production, point an external scheduler at
 * this route (Vercel Cron, a GitHub Actions cron job, or a Supabase
 * scheduled Edge Function) — see docs/billing-integration.md.
 *
 * Protected by a shared secret rather than Supabase auth because the
 * caller here is a scheduler, not a signed-in user. Safe to call more
 * often than needed: every run is idempotent, only acting on rows
 * whose own date columns say they're actually due.
 */
export async function POST(request: Request) {
  const configured = process.env.CRON_SECRET;
  if (!configured) {
    console.error("billing sweep: CRON_SECRET is not configured");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const provided = request.headers.get("authorization");
  if (provided !== `Bearer ${configured}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("sweep_subscription_lifecycle");

  if (error) {
    console.error("billing sweep: sweep_subscription_lifecycle failed", error);
    return NextResponse.json({ error: "sweep failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, transitions: data });
}
