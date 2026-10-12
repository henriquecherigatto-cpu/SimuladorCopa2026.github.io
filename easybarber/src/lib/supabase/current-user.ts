import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Não autenticado.");
    this.name = "NotAuthenticatedError";
  }
}

export class NoCompanyError extends Error {
  constructor() {
    super("Usuário não pertence a nenhuma barbearia.");
    this.name = "NoCompanyError";
  }
}

/**
 * Resolves the authenticated user's id straight from the verified
 * session — never from anything the caller passes in. Every Server
 * Action and server-side data fetch in this app starts here.
 */
export async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) throw new NotAuthenticatedError();
  return { supabase, userId };
}

export interface CurrentMembership {
  supabase: SupabaseClient<Database>;
  userId: string;
  companyId: string;
  role: "owner" | "professional";
  /** The caller's own professionals.id within this company, if their
   * profile is linked to a professional record (owners aren't always
   * linked to one). */
  professionalId: string | null;
  isPlatformAdmin: boolean;
}

/**
 * Resolves which company the current user acts on behalf of, and
 * with what role — derived from company_members (RLS-scoped to the
 * caller's own rows), never from a company_id a client could send.
 * Every mutation in src/lib/actions/*.ts calls this first.
 */
export async function requireMembership(): Promise<CurrentMembership> {
  const { supabase, userId } = await requireUserId();

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("company_members")
      .select("company_id, role")
      .eq("profile_id", userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", userId)
      .single(),
  ]);

  if (!membership) throw new NoCompanyError();

  const { data: professional } = await supabase
    .from("professionals")
    .select("id")
    .eq("company_id", membership.company_id)
    .eq("profile_id", userId)
    .maybeSingle();

  return {
    supabase,
    userId,
    companyId: membership.company_id,
    role: membership.role,
    professionalId: professional?.id ?? null,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
  };
}
