import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/ui/Avatar";

export function TopBar({ userName }: { userName: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-black/5 bg-white/90 px-4 backdrop-blur sm:px-6 lg:justify-end">
      <div className="lg:hidden">
        <Logo size="sm" />
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/configuracoes" className="hidden sm:block">
          <Avatar name={userName} size="sm" />
        </Link>
      </div>
    </header>
  );
}
