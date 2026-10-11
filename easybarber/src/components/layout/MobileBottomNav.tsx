"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { mobileTabNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileBottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-black/5 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
      {mobileTabNav.map((item) => {
        const isActive = item.matchPrefix
          ? pathname?.startsWith(item.matchPrefix)
          : pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium",
              isActive ? "text-brand-orange" : "text-brand-graphite/50",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
      <button
        onClick={onOpenMore}
        className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium text-brand-graphite/50"
      >
        <Menu className="size-5" />
        Mais
      </button>
    </nav>
  );
}
