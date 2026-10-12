"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { adminNav, primaryNav, secondaryNav, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = item.matchPrefix
    ? pathname?.startsWith(item.matchPrefix)
    : pathname === item.href;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-brand-orange text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      {item.label}
    </Link>
  );
}

export function Sidebar({
  userName,
  companyName,
  roleLabel,
  isPlatformAdmin,
}: {
  userName: string;
  companyName: string | null;
  roleLabel: string;
  isPlatformAdmin: boolean;
}) {
  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col bg-brand-graphite lg:flex">
      <div className="px-5 py-6">
        <Logo size="sm" wordmarkClassName="text-white" />
      </div>

      {companyName && (
        <div className="mx-4 mb-4 rounded-xl bg-white/5 px-3 py-2.5">
          <p className="truncate text-xs font-medium text-white/50">
            Barbearia
          </p>
          <p className="truncate text-sm font-semibold text-white">
            {companyName}
          </p>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {primaryNav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <div className="my-3 h-px bg-white/10" />

        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {isPlatformAdmin && (
          <>
            <div className="my-3 h-px bg-white/10" />
            {adminNav.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={userName} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-white">
              {userName}
            </span>
            <span className="truncate text-xs text-white/50">{roleLabel}</span>
          </div>
          <SignOutButton
            aria-label="Sair"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
          </SignOutButton>
        </div>
      </div>
    </aside>
  );
}
