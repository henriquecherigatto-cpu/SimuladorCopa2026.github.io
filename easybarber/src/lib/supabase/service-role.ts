import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Supabase client authenticated as service_role — bypasses Row Level
 * Security entirely. This is the ONLY client allowed to call
 * apply_billing_event()/sweep_subscription_lifecycle() (both are
 * REVOKEd from `authenticated`/`anon` in the database itself, so even
 * a stolen anon session could never reach them — this client is what
 * can).
 *
 * Import this ONLY from server-only trusted code that never ships to
 * the browser: the billing webhook route and the sweep route. Never
 * import it from a Server Action reachable with arbitrary
 * user-supplied input, a Client Component, or anything under
 * src/app that isn't one of those two routes — "server-only" above
 * makes an accidental client-bundle import a build error, but the
 * blast radius of misusing this client even on the server (e.g.
 * passing through unvalidated input) is "bypasses every RLS policy
 * in the database," so treat every call site as security-critical.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) is not configured — billing webhook/sweep routes cannot run without it.",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
