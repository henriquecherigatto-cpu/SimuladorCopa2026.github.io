import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets, Next's own internals,
     * and src/app/api/** — auth must be checked everywhere else,
     * including the root "/" (which itself redirects to /login or
     * /dashboard). The api/ exclusion matters: those routes
     * (billing webhook, billing sweep) are called by a payment
     * provider and an external scheduler, never by a signed-in
     * browser session, and authenticate themselves via their own
     * secret headers (see src/app/api/billing/*). Letting this
     * session-cookie redirect run on them would send every webhook
     * delivery to /login instead of the handler.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
