import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";

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
      .select("role, companies ( name )")
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

  const identity = {
    userName: profile?.full_name || profile?.email || "Usuário",
    companyName: membership?.companies?.name ?? null,
    roleLabel: membership
      ? (ROLE_LABELS[membership.role] ?? membership.role)
      : "Administrador da plataforma",
    isPlatformAdmin,
  };

  return <AppShell identity={identity}>{children}</AppShell>;
}
