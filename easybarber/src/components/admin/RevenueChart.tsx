"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrencyBRL } from "@/lib/utils";
import type { AdminRevenuePoint } from "@/lib/actions/admin";

const PLOT_HEIGHT = 180;

/**
 * Monthly revenue (confirmed payments only — see
 * admin_revenue_timeseries() in 20260101000023_admin_analytics.sql).
 * A single series, so this needs no categorical palette: one brand
 * hue for every bar, text in the usual ink tokens, a recessive
 * zero-line, and a hover tooltip with the exact value (the bars alone
 * only give a rough magnitude).
 */
export function RevenueChart({ data }: { data: AdminRevenuePoint[] }) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  const maxValue = Math.max(...data.map((d) => d.revenue_cents), 1);
  const hasAnyRevenue = data.some((d) => d.revenue_cents > 0);

  if (!hasAnyRevenue) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-brand-graphite/60">
          Nenhum pagamento confirmado ainda
        </p>
        <p className="text-xs text-brand-graphite/40">
          O fluxo de caixa aparece aqui assim que a primeira assinatura for paga.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-px sm:gap-1.5" style={{ height: PLOT_HEIGHT }}>
        {data.map((point, i) => {
          const barHeight = Math.max((point.revenue_cents / maxValue) * PLOT_HEIGHT, 2);
          const isHovered = hovered === i;
          return (
            <div
              key={point.month}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-end"
              style={{ height: PLOT_HEIGHT }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            >
              {isHovered && (
                <div className="pointer-events-none absolute -top-9 z-10 whitespace-nowrap rounded-lg bg-brand-graphite px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
                  {formatCurrencyBRL(point.revenue_cents / 100)}
                </div>
              )}
              <div
                className="w-full rounded-t-[4px] transition-opacity"
                style={{
                  height: barHeight,
                  minHeight: 2,
                  backgroundColor: "var(--color-brand-orange)",
                  opacity: isHovered ? 1 : 0.85,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-px sm:gap-1.5">
        {data.map((point) => (
          <div key={point.month} className="min-w-0 flex-1 text-center">
            <span className="text-[10px] font-medium uppercase text-brand-graphite/40">
              {format(new Date(`${point.month}T00:00:00`), "MMM", { locale: ptBR })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
