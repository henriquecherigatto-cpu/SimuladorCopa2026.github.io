import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notifyCompanyEnteringGracePeriod } from "@/lib/actions/subscription-notifications";

export const runtime = "nodejs";

/**
 * Triggers the date-driven half of the subscription state machine
 * (ativa → tolerancia once a due date passes, tolerancia → suspensa
 * once the 10-day grace period runs out — see
 * supabase/migrations/20260101000017_subscription_lifecycle.sql), then
 * WhatsApps each company that just entered tolerancia (see
 * notifyCompanyEnteringGracePeriod()) — nothing else announces either
 * one on its own; something has to check the clock. In production,
 * point an external scheduler at this route (Vercel Cron, a GitHub
 * Actions cron job, or a Supabase scheduled Edge Function) — see
 * docs/billing-integration.md.
 *
 * Protected by a shared secret rather than Supabase auth because the
 * caller here is a scheduler, not a signed-in user. Safe to call more
 * often than needed: every run is idempotent, only acting on rows
 * whose own date columns say they're actually due.
 *
 * Responds to both GET and POST with the same handler: Vercel Cron
 * Jobs invoke their target path via GET (and, when an env var is
 * literally named CRON_SECRET, automatically attach it as this exact
 * `Authorization: Bearer <value>` header — see vercel.json and
 * docs/billing-integration.md), while a manual curl check or a
 * different scheduler (GitHub Actions, cron-job.org, pg_cron calling
 * sweep_subscription_lifecycle() directly) is free to use POST.
 */
async function handleSweep(request: Request) {
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

  const transitions = data ?? [];

  // Tell the barbershop itself, by WhatsApp, the moment it enters the
  // grace period — not on every sweep run afterwards, just this one
  // transition. A notification failure must never fail the sweep
  // response: the state machine itself already ran and committed
  // above regardless of whether this message goes out.
  const enteredGracePeriod = transitions.filter((t) => t.new_status === "tolerancia");
  await Promise.all(
    enteredGracePeriod.map((t) =>
      notifyCompanyEnteringGracePeriod(t.company_id).catch((err) => {
        console.error(
          `billing sweep: failed to notify company ${t.company_id} entering grace period`,
          err,
        );
      }),
    ),
  );

  return NextResponse.json({ ok: true, transitions });
}

export const GET = handleSweep;
export const POST = handleSweep;
