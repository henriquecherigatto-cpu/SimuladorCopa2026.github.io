"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AgendaViewSwitch() {
  const pathname = usePathname();
  const isDay = pathname?.endsWith("/dia");

  return (
    <div className="inline-flex rounded-xl bg-black/5 p-1">
      <Link
        href="/agenda/dia"
        className={cn(
          "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
          isDay
            ? "bg-white text-brand-graphite shadow-sm"
            : "text-brand-graphite/50",
        )}
      >
        Dia
      </Link>
      <Link
        href="/agenda"
        className={cn(
          "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
          !isDay
            ? "bg-white text-brand-graphite shadow-sm"
            : "text-brand-graphite/50",
        )}
      >
        Semana
      </Link>
    </div>
  );
}
