"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

/**
 * A plain visit to this page signs the current browser out — no click
 * needed. For quickly resetting between test signups (bookmark this
 * URL), or for sharing a "log out of this device" link.
 */
export function SairClient() {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.signOut().finally(() => {
      router.push("/login");
      router.refresh();
    });
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-surface px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <Logo />
        <Loader2 className="size-6 animate-spin text-brand-orange" />
        <p className="text-sm text-brand-graphite/60">Saindo da sua conta...</p>
      </div>
    </div>
  );
}
