import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types";
import type { Database } from "@/lib/supabase/database.types";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

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
  SubscriptionStatus,
  { label: string; className: string }
> = {
  ativa: { label: "Ativa", className: "bg-emerald-100 text-emerald-800" },
  pendente: { label: "Pendente", className: "bg-amber-100 text-amber-800" },
  tolerancia: { label: "Em tolerância", className: "bg-orange-100 text-orange-800" },
  suspensa: { label: "Suspensa", className: "bg-red-100 text-red-700" },
  cancelada: { label: "Cancelada", className: "bg-slate-100 text-slate-600" },
};

export function SubscriptionStatusBadge({
  status,
  className,
}: {
  status: SubscriptionStatus | null;
  className?: string;
}) {
  if (!status) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500",
          className,
        )}
      >
        Sem assinatura
      </span>
    );
  }
  const info = subscriptionStatusMap[status];
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
