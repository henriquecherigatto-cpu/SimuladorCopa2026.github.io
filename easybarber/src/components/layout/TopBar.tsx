import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/ui/Avatar";

export function TopBar({ userName }: { userName: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-black/5 bg-white/90 px-4 backdrop-blur sm:px-6 lg:justify-end">
      <div className="lg:hidden">
        <Logo size="sm" />
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          aria-label="Notificações"
          className="relative flex size-10 items-center justify-center rounded-full text-brand-graphite/60 hover:bg-black/5"
        >
          <Bell className="size-5" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand-orange" />
        </button>
        <Link href="/configuracoes" className="hidden sm:block">
          <Avatar name={userName} size="sm" />
        </Link>
      </div>
    </header>
  );
}
