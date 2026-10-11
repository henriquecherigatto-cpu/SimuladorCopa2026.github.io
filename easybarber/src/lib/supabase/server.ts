import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Supabase client for Server Components, Server Actions and Route
 * Handlers. Create a fresh one per request — never reuse across
 * requests/users.
 *
 * Reading a cookie from a Server Component can throw (the Next.js
 * cookies API is read-only there); the try/catch below is the
 * documented way to handle that — session refresh is instead handled
 * by src/proxy.ts, which runs before the Server Component and can
 * write cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — ignore, proxy.ts
            // already refreshes the session on the way in.
          }
        },
      },
    },
  );
}
