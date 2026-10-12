import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "success" | "error" | "warning" | "info";

const variantConfig: Record<
  AlertVariant,
  { icon: typeof Info; classes: string }
> = {
  success: {
    icon: CheckCircle2,
    classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  error: {
    icon: XCircle,
    classes: "bg-red-50 text-brand-error border-red-200",
  },
  warning: {
    icon: AlertTriangle,
    classes: "bg-amber-50 text-amber-800 border-amber-200",
  },
  info: {
    icon: Info,
    classes: "bg-blue-50 text-blue-800 border-blue-200",
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, classes } = variantConfig[variant];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        classes,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-sm opacity-90">{children}</div>}
      </div>
    </div>
  );
}
