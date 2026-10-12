import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CreateCompanyForm } from "@/components/auth/CreateCompanyForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cadastre sua barbearia — Easy Barber" };

export default async function OnboardingEmpresaPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", userId)
      .single(),
    supabase
      .from("company_members")
      .select("company_id")
      .eq("profile_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);

  // Already has a company (or is an admin with no need for one) —
  // nothing to do here.
  if (membership || profile?.is_platform_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-surface px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="text-sm text-brand-graphite/60">
            Falta pouco! Cadastre sua barbearia para começar a usar o Easy
            Barber.
          </p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
          <h1 className="mb-5 text-lg font-bold text-brand-graphite">
            Cadastre sua barbearia
          </h1>
          <CreateCompanyForm />
        </div>
      </div>
    </div>
  );
}
