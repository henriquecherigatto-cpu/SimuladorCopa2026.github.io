import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "orange",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "orange" | "graphite" | "success";
  className?: string;
}) {
  const toneClasses = {
    orange: "bg-brand-orange/10 text-brand-orange",
    graphite: "bg-brand-graphite/10 text-brand-graphite",
    success: "bg-brand-success/10 text-brand-success",
  };
  return (
    <Card className={cn("min-w-0 p-4 sm:p-5", className)}>
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="break-words text-lg font-bold leading-tight text-brand-graphite sm:text-2xl">
            {value}
          </span>
          <span className="break-words text-sm leading-tight text-brand-graphite/60">{label}</span>
          {hint && (
            <span className="break-words text-xs leading-tight text-brand-graphite/40">{hint}</span>
          )}
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            toneClasses[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}
