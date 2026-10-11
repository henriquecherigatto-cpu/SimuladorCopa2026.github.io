"use client";

import Link from "next/link";
import { LogOut, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { adminNav, primaryNav, secondaryNav } from "@/lib/nav";
import { demoUser } from "@/lib/mock-data";

export function MoreSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const items = [...primaryNav, ...secondaryNav, ...adminNav];

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={demoUser.name} size="sm" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-brand-graphite">
                {demoUser.name}
              </span>
              <span className="text-xs text-brand-graphite/50">
                Proprietário
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-9 items-center justify-center rounded-full text-brand-graphite/50 hover:bg-black/5"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-1 py-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-brand-graphite hover:bg-brand-surface"
              >
                <Icon className="size-[18px] text-brand-graphite/60" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/login"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-brand-error hover:bg-red-50"
          >
            <LogOut className="size-[18px]" />
            Sair
          </Link>
        </div>
      </div>
    </div>
  );
}
