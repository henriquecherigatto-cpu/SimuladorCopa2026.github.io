"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

/**
 * Lands here from the signup confirmation e-mail's link
 * (SignupForm.tsx sets emailRedirectTo to this page). The browser's
 * Supabase client auto-detects the ?code= in the URL and establishes
 * a session on its own (same mechanism UpdatePasswordForm.tsx relies
 * on for password recovery) — there is no session yet on the very
 * first paint, so this listens for it instead of assuming it.
 *
 * Once signed in, creates the barbearia from the company_* fields
 * SignupForm.tsx stored in the user's metadata at signup time (the
 * RPC couldn't run back then — no session existed to authenticate
 * it) and continues straight into the onboarding sequence, instead of
 * asking the owner to re-type everything they already entered.
 */
export function ConfirmadoOnboardingClient() {
  const router = useRouter();
  const [status, setStatus] = React.useState<"waiting" | "error">("waiting");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const finish = async (userId: string) => {
      if (settled) return;
      settled = true;

      const { data: membership } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("profile_id", userId)
        .limit(1)
        .maybeSingle();

      // Already has a company (e.g. the confirmation link was opened
      // a second time) — just let the usual gates route correctly.
      if (membership) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const meta = userData.user?.user_metadata ?? {};
      const companyName = typeof meta.company_name === "string" ? meta.company_name : "";
      const companyPhone = typeof meta.company_phone === "string" ? meta.company_phone : "";

      // No metadata to work with (e.g. an account from before this
      // flow existed) — fall back to the manual company form instead
      // of a dead end.
      if (!companyName || !companyPhone) {
        router.push("/onboarding/empresa");
        return;
      }

      const companyCnpj = typeof meta.company_cnpj === "string" ? meta.company_cnpj : undefined;
      const companyAddress =
        typeof meta.company_address === "string" ? meta.company_address : undefined;

      const { error } = await supabase.rpc("create_company_with_owner", {
        p_name: companyName,
        p_phone: companyPhone,
        p_cnpj: companyCnpj,
        p_address: companyAddress,
      });

      if (error) {
        setErrorMessage(
          `Seu e-mail foi confirmado, mas não foi possível concluir o cadastro da barbearia automaticamente (${error.message}). Você pode tentar novamente ao entrar.`,
        );
        setStatus("error");
        return;
      }

      router.push("/onboarding/pagamento");
      router.refresh();
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) finish(session.user.id);
    });

    // onAuthStateChange only fires on a CHANGE — if the session was
    // already established by the time this listener attached, this
    // catches that case too.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) finish(data.user.id);
    });

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setStatus("error");
        setErrorMessage("Não conseguimos confirmar automaticamente. Faça login para continuar.");
      }
    }, 8000);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  if (status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-brand-surface px-4 py-10 sm:px-6">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo />
          </div>
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
            <Alert variant="error" title="Algo não saiu como esperado">
              {errorMessage}
            </Alert>
            <Button href="/login" fullWidth className="mt-4">
              Ir para o login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-surface px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <Logo />
        <Loader2 className="size-6 animate-spin text-brand-orange" />
        <p className="text-sm text-brand-graphite/60">
          E-mail confirmado! Preparando o cadastro da sua barbearia...
        </p>
      </div>
    </div>
  );
}
