import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
        <Icon className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-brand-graphite">{title}</p>
        {description && (
          <p className="max-w-xs text-sm text-brand-graphite/60">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
