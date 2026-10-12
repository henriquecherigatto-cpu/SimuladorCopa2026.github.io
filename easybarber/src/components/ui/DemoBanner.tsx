import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg bg-brand-graphite px-3 py-2 text-xs font-medium text-white/90",
        className,
      )}
    >
      <FlaskConical className="size-3.5 shrink-0 text-brand-orange" />
      <span>
        Modo demonstração — todos os dados exibidos são fictícios e não são
        salvos.
      </span>
    </div>
  );
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-brand-orange/10 px-2 py-0.5 text-[11px] font-medium text-brand-orange-dark",
        className,
      )}
    >
      <FlaskConical className="size-3" />
      Demonstração
    </span>
  );
}
