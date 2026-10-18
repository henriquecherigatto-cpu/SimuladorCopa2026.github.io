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
        // Stacked directly above SupportWhatsAppButton (same fixed
        // bottom-right corner, size-14) at every breakpoint — these
        // two buttons previously shared the exact same position and
        // overlapped. 44-24px gaps above its top edge, mobile/desktop.
        "fixed bottom-44 right-4 z-20 flex size-14 items-center justify-center rounded-full bg-brand-orange text-white shadow-lg shadow-brand-orange/30 transition-transform hover:scale-105 active:scale-95 lg:bottom-24 lg:right-8",
        className,
      )}
    >
      <Plus className="size-6" strokeWidth={2.5} />
    </Link>
  );
}
