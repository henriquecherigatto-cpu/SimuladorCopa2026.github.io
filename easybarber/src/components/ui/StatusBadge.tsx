import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types";
import type { SubscriptionStatusLabel } from "@/lib/mock-data";

const appointmentStatusMap: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  agendado: {
    label: "Pendente",
    className: "bg-amber-100 text-amber-800",
  },
  confirmado: {
    label: "Confirmado",
    className: "bg-emerald-100 text-emerald-800",
  },
  concluido: {
    label: "Concluído",
    className: "bg-slate-100 text-slate-700",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-100 text-red-700",
  },
};

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  const info = appointmentStatusMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        info.className,
        className,
      )}
    >
      {info.label}
    </span>
  );
}

const subscriptionStatusMap: Record<
  SubscriptionStatusLabel,
  { className: string }
> = {
  Ativo: { className: "bg-emerald-100 text-emerald-800" },
  Pendente: { className: "bg-amber-100 text-amber-800" },
  "Em tolerância": { className: "bg-orange-100 text-orange-800" },
  Suspenso: { className: "bg-red-100 text-red-700" },
  Cancelado: { className: "bg-slate-100 text-slate-600" },
};

export function SubscriptionStatusBadge({
  status,
  className,
}: {
  status: SubscriptionStatusLabel;
  className?: string;
}) {
  const info = subscriptionStatusMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        info.className,
        className,
      )}
    >
      {status}
    </span>
  );
}

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: "neutral" | "success" | "warning" | "danger" | "brand";
  className?: string;
}) {
  const variants = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-700",
    brand: "bg-brand-orange/10 text-brand-orange-dark",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
