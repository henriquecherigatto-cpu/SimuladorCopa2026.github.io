"use client";

import * as React from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { cn, WEEKDAY_LETTERS } from "@/lib/utils";

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/**
 * Month-grid date picker for the Agenda's "jump to any date" affordance
 * (item 20) — nothing like this existed in the component library, so
 * it's built from scratch on top of date-fns, which was already a
 * dependency.
 */
export function MiniCalendarModal({
  open,
  selectedDate,
  onSelect,
  onClose,
}: {
  open: boolean;
  /** yyyy-MM-dd */
  selectedDate: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const selectedObj = React.useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);
  const [cursor, setCursor] = React.useState(selectedObj);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setCursor(selectedObj);
  }, [open, selectedObj]);

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const today = new Date();

  return (
    <Modal open={open} onClose={onClose} title="Selecionar data">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label="Mês anterior"
            className="flex size-8 items-center justify-center rounded-lg text-brand-graphite/60 hover:bg-black/5"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-sm font-semibold capitalize text-brand-graphite">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </p>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Próximo mês"
            className="flex size-8 items-center justify-center rounded-lg text-brand-graphite/60 hover:bg-black/5"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-brand-graphite/40">
          {MONDAY_FIRST.map((w) => (
            <span key={w}>{WEEKDAY_LETTERS[w]}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const inMonth = isSameMonth(day, cursor);
            const isSelected = isSameDay(day, selectedObj);
            const isToday = isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelect(format(day, "yyyy-MM-dd"))}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg text-sm transition-colors",
                  isSelected
                    ? "bg-brand-orange font-semibold text-white"
                    : inMonth
                      ? "text-brand-graphite hover:bg-black/5"
                      : "text-brand-graphite/25 hover:bg-black/5",
                  isToday && !isSelected && "ring-1 ring-inset ring-brand-orange/40",
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
