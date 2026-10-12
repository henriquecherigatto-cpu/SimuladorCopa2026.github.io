"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarOff, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { AppointmentStatusBadge } from "@/components/ui/StatusBadge";
import { AppointmentDetailsModal } from "@/components/agenda/AppointmentDetailsModal";
import {
  listAppointmentsInRange,
  type AppointmentListItem,
} from "@/lib/actions/appointments";
import { cn, hhmmToMinutes, minutesToHHMM } from "@/lib/utils";

const SLOT_MINUTES = 30;
const ROW_HEIGHT = 64; // px per 30-minute slot
const COLUMN_GAP = 4; // px between side-by-side appointments
const ROW_OUTER_MARGIN = 8; // px from the day column's own edges

interface PositionedAppointment extends AppointmentListItem {
  top: number;
  height: number;
  col: number;
  totalCols: number;
}

/**
 * Appointments only ever overlap in time across DIFFERENT
 * professionals (the database forbids one professional double-
 * booking themselves) — completely normal with more than one barber
 * working at once. Without this, every appointment block is
 * positioned at the same full width regardless of others happening
 * at the same time, so their text stacks directly on top of each
 * other. This lays out time-overlapping appointments side by side
 * instead, the same way most calendar day views do: group
 * appointments into clusters of transitively-overlapping times, then
 * greedily assign each one the first free column within its cluster.
 */
function layoutDayAppointments(
  items: AppointmentListItem[],
  openMin: number,
): PositionedAppointment[] {
  const withMinutes = items
    .map((appt) => {
      const start = new Date(appt.starts_at);
      const end = new Date(appt.ends_at);
      return {
        appt,
        startMin: start.getHours() * 60 + start.getMinutes(),
        endMin: end.getHours() * 60 + end.getMinutes(),
      };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const groups: (typeof withMinutes)[] = [];
  let currentGroup: typeof withMinutes = [];
  let currentGroupEnd = -Infinity;
  for (const item of withMinutes) {
    if (currentGroup.length === 0 || item.startMin < currentGroupEnd) {
      currentGroup.push(item);
      currentGroupEnd = Math.max(currentGroupEnd, item.endMin);
    } else {
      groups.push(currentGroup);
      currentGroup = [item];
      currentGroupEnd = item.endMin;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const result: PositionedAppointment[] = [];
  for (const group of groups) {
    const columnEnds: number[] = [];
    const cols: number[] = [];
    for (const item of group) {
      let placed = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= item.startMin) {
          columnEnds[c] = item.endMin;
          placed = c;
          break;
        }
      }
      if (placed === -1) {
        columnEnds.push(item.endMin);
        placed = columnEnds.length - 1;
      }
      cols.push(placed);
    }
    const totalCols = columnEnds.length;
    group.forEach((item, i) => {
      result.push({
        ...item.appt,
        top: ((item.startMin - openMin) / SLOT_MINUTES) * ROW_HEIGHT,
        height: Math.max(
          ((item.endMin - item.startMin) / SLOT_MINUTES) * ROW_HEIGHT - 4,
          28,
        ),
        col: cols[i],
        totalCols,
      });
    });
  }

  return result;
}

export interface ProfessionalChip {
  id: string;
  name: string;
  color: string;
}

export interface BusinessHoursRow {
  day_of_week: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
}

function toISODate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function AgendaDayView({
  professionals,
  businessHours,
}: {
  professionals: ProfessionalChip[];
  businessHours: BusinessHoursRow[];
}) {
  const [selectedDate, setSelectedDate] = React.useState(() => toISODate(new Date()));
  const [activeProfessional, setActiveProfessional] = React.useState<
    string | "todos"
  >("todos");
  const [detailsAppt, setDetailsAppt] = React.useState<AppointmentListItem | null>(
    null,
  );
  const [appointments, setAppointments] = React.useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadAppointments = React.useCallback(() => {
    setLoading(true);
    listAppointmentsInRange(selectedDate, selectedDate).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setAppointments(result.data);
    });
  }, [selectedDate]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAppointments();
  }, [loadAppointments]);

  const dateObj = React.useMemo(
    () => new Date(`${selectedDate}T00:00:00`),
    [selectedDate],
  );
  const weekday = dateObj.getDay();
  const hours = businessHours.find((h) => h.day_of_week === weekday) ?? {
    day_of_week: weekday,
    is_open: false,
    start_time: "08:00",
    end_time: "18:00",
  };
  const isToday = selectedDate === toISODate(new Date());

  const dayAppointments = appointments.filter(
    (a) =>
      activeProfessional === "todos" || a.professional?.id === activeProfessional,
  );

  const openMin = hhmmToMinutes(hours.start_time.slice(0, 5));
  const closeMin = hhmmToMinutes(hours.end_time.slice(0, 5));
  const totalSlots = Math.max(0, Math.ceil((closeMin - openMin) / SLOT_MINUTES));
  const hourMarks: number[] = [];
  for (let m = openMin; m <= closeMin; m += 60) hourMarks.push(m);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate((d) => toISODate(addDays(new Date(`${d}T00:00:00`), -1)))}
            aria-label="Dia anterior"
            className="flex size-9 items-center justify-center rounded-lg border border-black/10 bg-white text-brand-graphite/60 hover:bg-black/5"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold capitalize text-brand-graphite">
              {format(dateObj, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            {isToday && (
              <p className="text-xs font-medium text-brand-orange">Hoje</p>
            )}
          </div>
          <button
            onClick={() => setSelectedDate((d) => toISODate(addDays(new Date(`${d}T00:00:00`), 1)))}
            aria-label="Próximo dia"
            className="flex size-9 items-center justify-center rounded-lg border border-black/10 bg-white text-brand-graphite/60 hover:bg-black/5"
          >
            <ChevronRight className="size-4" />
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(toISODate(new Date()))}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-orange hover:bg-brand-orange/10"
            >
              Hoje
            </button>
          )}
        </div>

        <Button
          href="/agenda/novo"
          size="sm"
          icon={<CalendarPlus className="size-4" />}
          className="hidden sm:inline-flex"
        >
          Novo agendamento
        </Button>
      </div>

      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          onClick={() => setActiveProfessional("todos")}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            activeProfessional === "todos"
              ? "bg-brand-orange text-white"
              : "bg-white text-brand-graphite/60 border border-black/10 hover:text-brand-graphite",
          )}
        >
          Todos
        </button>
        {professionals.map((prof) => (
          <button
            key={prof.id}
            onClick={() => setActiveProfessional(prof.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors border",
              activeProfessional === prof.id
                ? "text-white border-transparent"
                : "bg-white text-brand-graphite/60 border-black/10 hover:text-brand-graphite",
            )}
            style={
              activeProfessional === prof.id
                ? { backgroundColor: prof.color }
                : undefined
            }
          >
            <Avatar name={prof.name} color={prof.color} size="sm" />
            {prof.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        {error ? (
          <EmptyState icon={CalendarOff} title="Não foi possível carregar a agenda" description={error} />
        ) : loading ? (
          <p className="py-10 text-center text-sm text-brand-graphite/40">Carregando...</p>
        ) : !hours.is_open ? (
          <EmptyState
            icon={CalendarOff}
            title="Fechado neste dia"
            description="A barbearia não funciona neste dia da semana. Ajuste o horário de funcionamento em Configurações."
          />
        ) : dayAppointments.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="Nenhum agendamento neste dia"
            description="A agenda está livre. Que tal criar um novo agendamento?"
            action={
              <Button href="/agenda/novo" size="sm">
                Criar agendamento
              </Button>
            }
          />
        ) : (
          <div className="flex">
            <div
              className="relative w-14 shrink-0 sm:w-16"
              style={{ height: totalSlots * ROW_HEIGHT }}
            >
              {hourMarks.map((m) => (
                <span
                  key={m}
                  className="absolute right-2 -translate-y-1/2 text-xs text-brand-graphite/40"
                  style={{ top: ((m - openMin) / SLOT_MINUTES) * ROW_HEIGHT }}
                >
                  {minutesToHHMM(m)}
                </span>
              ))}
            </div>
            <div
              className="relative flex-1 border-l border-black/5"
              style={{ height: totalSlots * ROW_HEIGHT }}
            >
              {hourMarks.map((m) => (
                <div
                  key={m}
                  className="absolute inset-x-0 border-t border-black/5"
                  style={{ top: ((m - openMin) / SLOT_MINUTES) * ROW_HEIGHT }}
                />
              ))}
              {layoutDayAppointments(dayAppointments, openMin).map((appt) => {
                const start = new Date(appt.starts_at);
                const cancelled = appt.status === "cancelado";
                const color = appt.professional?.color ?? "#FF6B1A";
                const colWidth = `((100% - ${ROW_OUTER_MARGIN * 2}px - ${(appt.totalCols - 1) * COLUMN_GAP}px) / ${appt.totalCols})`;
                return (
                  <button
                    key={appt.id}
                    onClick={() => setDetailsAppt(appt)}
                    style={{
                      top: appt.top,
                      height: appt.height,
                      left: `calc(${ROW_OUTER_MARGIN}px + ${appt.col} * (${colWidth} + ${COLUMN_GAP}px))`,
                      width: `calc(${colWidth})`,
                      borderLeftColor: color,
                      backgroundColor: `${color}14`,
                    }}
                    className={cn(
                      "absolute flex flex-col justify-center gap-0.5 overflow-hidden rounded-lg border-l-4 px-3 py-1.5 text-left transition-opacity hover:opacity-80",
                      cancelled && "opacity-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-brand-graphite sm:text-sm">
                        {format(start, "HH:mm")} · {appt.customer?.name}
                      </p>
                      <AppointmentStatusBadge
                        status={appt.status}
                        className="hidden shrink-0 sm:inline-flex"
                      />
                    </div>
                    <p className="truncate text-xs text-brand-graphite/60">
                      {appt.service?.name}
                      {activeProfessional === "todos" && appt.professional
                        ? ` · ${appt.professional.name}`
                        : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AppointmentDetailsModal
        appointment={detailsAppt}
        onClose={() => setDetailsAppt(null)}
        onChanged={loadAppointments}
      />
    </div>
  );
}
