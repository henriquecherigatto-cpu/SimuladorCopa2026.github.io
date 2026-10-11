import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Fab({
  href,
  label = "Novo agendamento",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "fixed bottom-24 right-4 z-20 flex size-14 items-center justify-center rounded-full bg-brand-orange text-white shadow-lg shadow-brand-orange/30 transition-transform hover:scale-105 active:scale-95 lg:bottom-8 lg:right-8",
        className,
      )}
    >
      <Plus className="size-6" strokeWidth={2.5} />
    </Link>
  );
}
