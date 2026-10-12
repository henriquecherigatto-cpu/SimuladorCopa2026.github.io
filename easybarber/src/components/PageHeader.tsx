import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-brand-graphite sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-brand-graphite/60">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
