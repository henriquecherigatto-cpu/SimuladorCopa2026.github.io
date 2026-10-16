import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

const PUBLIC_ROUTES = ["/", "/login", "/cadastro", "/recuperar-senha"];

// Accessible regardless of auth state, and never redirected either
// way — unlike PUBLIC_ROUTES (login/cadastro/...), which bounce an
// already-authenticated visitor to /dashboard. /agendar/<slug> is the
// self-service booking page a barbearia's own clients use, and
// /cancelar/<token> is the cancel-by-link page a booking confirmation
// message points to; the owner should also be able to open either
// while signed in (e.g. to test it) without being redirected away.
// /atualizar-senha needs this same treatment for a different reason:
// the password-recovery email's link lands here with a ?code= that
// the BROWSER exchanges for a session client-side (detectSessionInUrl
// in src/lib/supabase/client.ts) — this request arrives with no
// session cookie yet, so treating it as an ordinary protected route
// would redirect to /login and strip the code before that exchange
// ever runs. And once the exchange DOES complete, the visitor is now
// "authenticated" by this middleware's own check, so leaving it out
// of PUBLIC_ROUTES matters too — that list bounces an authenticated
// visitor straight to /dashboard, which here would mean away from the
// password form before they ever get to submit it.
const ALWAYS_ACCESSIBLE_PREFIXES = ["/agendar/", "/cancelar/", "/atualizar-senha"];

/**
 * Refreshes the Supabase session cookie on every request (so it never
 * silently expires mid-visit) and does an OPTIMISTIC redirect for
 * logged-out/logged-in users hitting the wrong area.
 *
 * This is explicitly the *optimistic* check — the Next.js auth guide
 * is clear that Proxy/middleware must not be the only line of
 * defense. The authoritative defense here is Postgres Row Level
 * Security: every query a Server Component makes already goes
 * through the real RLS policies (see supabase/migrations), so even if
 * this redirect were somehow bypassed, no cross-company data would be
 * reachable.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Triggers lazy session init / refresh before any route code runs.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = !!data?.claims;

  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route);
  const isAlwaysAccessible = ALWAYS_ACCESSIBLE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (isAlwaysAccessible) {
    return response;
  }

  if (!isAuthenticated && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
