"use client";

import { Switch } from "@/components/ui/Switch";
import type { BusinessHours } from "@/types";

/**
 * The day-by-day open/closed + start/end time editor, shared between
 * the Configurações modal (ConfiguracoesPageClient.tsx) and the
 * onboarding "horários" step — same fields, same
 * updateBusinessHours() save path, different surrounding chrome.
 */
export function BusinessHoursFields({
  hours,
  onChange,
}: {
  hours: BusinessHours[];
  onChange: (next: BusinessHours[]) => void;
}) {
  const update = (day: string, patch: Partial<BusinessHours>) => {
    onChange(hours.map((h) => (h.day === day ? { ...h, ...patch } : h)));
  };

  return (
    <div className="flex flex-col gap-3">
      {hours.map((h) => (
        <div
          key={h.day}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-black/5 px-3 py-2.5"
        >
          <Switch
            checked={h.open}
            onChange={(checked) => update(h.day, { open: checked })}
          />
          <span className="w-28 text-sm font-medium text-brand-graphite">
            {h.day}
          </span>
          {h.open ? (
            <div className="flex items-center gap-1.5 text-sm">
              <input
                type="time"
                value={h.start}
                onChange={(e) => update(h.day, { start: e.target.value })}
                className="rounded-lg border border-black/10 px-2 py-1 text-sm"
              />
              <span className="text-brand-graphite/40">–</span>
              <input
                type="time"
                value={h.end}
                onChange={(e) => update(h.day, { end: e.target.value })}
                className="rounded-lg border border-black/10 px-2 py-1 text-sm"
              />
            </div>
          ) : (
            <span className="text-sm text-brand-graphite/40">Fechado</span>
          )}
        </div>
      ))}
    </div>
  );
}
