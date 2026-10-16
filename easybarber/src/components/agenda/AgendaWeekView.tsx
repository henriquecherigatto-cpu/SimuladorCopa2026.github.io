"use client";

import * as React from "react";
import { addDays, addWeeks, format, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarOff, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { AppointmentStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppointmentDetailsModal } from "@/components/agenda/AppointmentDetailsModal";
import {
  listAppointmentsInRange,
  type AppointmentListItem,
} from "@/lib/actions/appointments";
import { cn, todayISOInAppTimezone, todayInAppTimezone } from "@/lib/utils";
import type { ProfessionalChip } from "@/components/agenda/AgendaDayView";

function toISODate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

/**
 * Appointments only ever overlap in time across DIFFERENT
 * professionals — the database forbids one professional double-
 * booking themselves (same exclusion constraint AgendaDayView.tsx's
 * own layoutDayAppointments() relies on). Groups a day's appointments
 * into clusters of transitively-overlapping times, so each cluster
 * renders as one row of side-by-side chips instead of a plain vertical
 * stack, which otherwise reads as a sequential queue even when two
 * appointments are actually at the same time with different barbers.
 */
function groupOverlappingAppointments(
  items: AppointmentListItem[],
): AppointmentListItem[][] {
  const withMillis = items
    .map((appt) => ({
      appt,
      startMs: new Date(appt.starts_at).getTime(),
      endMs: new Date(appt.ends_at).getTime(),
    }))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const groups: AppointmentListItem[][] = [];
  let current: typeof withMillis = [];
  let currentEnd = -Infinity;
  for (const item of withMillis) {
    if (current.length === 0 || item.startMs < currentEnd) {
      current.push(item);
      currentEnd = Math.max(currentEnd, item.endMs);
    } else {
      groups.push(current.map((c) => c.appt));
      current = [item];
      currentEnd = item.endMs;
    }
  }
  if (current.length > 0) groups.push(current.map((c) => c.appt));

  return groups;
}

export function AgendaWeekView({
  professionals,
}: {
  professionals: ProfessionalChip[];
}) {
  const [weekStart, setWeekStart] = React.useState(() =>
    startOfWeek(todayInAppTimezone(), { weekStartsOn: 1 }),
  );
  const [activeProfessional, setActiveProfessional] = React.useState<
    string | "todos"
  >("todos");
  const [mobileDay, setMobileDay] = React.useState(() => todayISOInAppTimezone());
  const [detailsAppt, setDetailsAppt] = React.useState<AppointmentListItem | null>(
    null,
  );
  const [appointments, setAppointments] = React.useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const loadAppointments = React.useCallback(() => {
    setLoading(true);
    listAppointmentsInRange(toISODate(days[0]), toISODate(days[6])).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setAppointments(result.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAppointments();
  }, [loadAppointments]);

  const getDayAppointments = (date: Date) => {
    const iso = toISODate(date);
    return appointments.filter((a) => {
      const matchesDay = a.starts_at.slice(0, 10) === iso;
      const matchesProfessional =
        activeProfessional === "todos" || a.professional?.id === activeProfessional;
      return matchesDay && matchesProfessional;
    });
  };

  const weekLabel = `${format(days[0], "d 'de' MMM", { locale: ptBR })} – ${format(days[6], "d 'de' MMM", { locale: ptBR })}`;

  const AppointmentChip = ({ appt }: { appt: AppointmentListItem }) => (
    <button
      onClick={() => setDetailsAppt(appt)}
      style={{
        borderLeftColor: appt.professional?.color ?? "#FF6B1A",
        backgroundColor: `${appt.professional?.color ?? "#FF6B1A"}14`,
      }}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-lg border-l-4 px-2.5 py-1.5 text-left transition-opacity hover:opacity-80",
        appt.status === "cancelado" && "opacity-50",
      )}
    >
      <span className="truncate text-xs font-semibold text-brand-graphite">
        {format(new Date(appt.starts_at), "HH:mm")} · {appt.customer?.name}
      </span>
      <span className="truncate text-[11px] text-brand-graphite/60">
        {appt.service?.name}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
            aria-label="Semana anterior"
            className="flex size-9 items-center justify-center rounded-lg border border-black/10 bg-white text-brand-graphite/60 hover:bg-black/5"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-sm font-semibold capitalize text-brand-graphite">
            {weekLabel}
          </p>
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            aria-label="Próxima semana"
            className="flex size-9 items-center justify-center rounded-lg border border-black/10 bg-white text-brand-graphite/60 hover:bg-black/5"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(todayInAppTimezone(), { weekStartsOn: 1 }))}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-orange hover:bg-brand-orange/10"
          >
            Hoje
          </button>
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
            <Avatar name={prof.name} color={prof.color} photoUrl={prof.photo_url} size="sm" />
            {prof.name}
          </button>
        ))}
      </div>

      {error ? (
        <EmptyState icon={CalendarOff} title="Não foi possível carregar a agenda" description={error} />
      ) : loading ? (
        <p className="py-10 text-center text-sm text-brand-graphite/40">Carregando...</p>
      ) : (
        <>
          {/* Desktop: 7-column grid */}
          <div className="hidden grid-cols-7 gap-3 sm:grid">
            {days.map((day) => {
              const isToday = isSameDay(day, todayInAppTimezone());
              const dayAppts = getDayAppointments(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "flex flex-col gap-2 rounded-2xl border bg-white p-3",
                    isToday ? "border-brand-orange/40" : "border-black/5",
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5 pb-1">
                    <span className="text-[11px] font-medium uppercase text-brand-graphite/40">
                      {format(day, "EEE", { locale: ptBR })}
                    </span>
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                        isToday
                          ? "bg-brand-orange text-white"
                          : "text-brand-graphite",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {dayAppts.length === 0 ? (
                      <p className="py-4 text-center text-xs text-brand-graphite/30">
                        Sem agendamentos
                      </p>
                    ) : (
                      groupOverlappingAppointments(dayAppts).map((group) => (
                        <div key={group[0].id} className="flex gap-1.5">
                          {group.map((appt) => (
                            <div key={appt.id} className="min-w-0 flex-1">
                              <AppointmentChip appt={appt} />
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: day selector + list */}
          <div className="flex flex-col gap-3 sm:hidden">
            <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {days.map((day) => {
                const iso = toISODate(day);
                const isSelected = iso === mobileDay;
                const isToday = isSameDay(day, todayInAppTimezone());
                return (
                  <button
                    key={iso}
                    onClick={() => setMobileDay(iso)}
                    className={cn(
                      "flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-2",
                      isSelected ? "bg-brand-orange text-white" : "bg-white border border-black/10 text-brand-graphite",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-medium uppercase",
                        isSelected ? "text-white/80" : "text-brand-graphite/40",
                      )}
                    >
                      {format(day, "EEE", { locale: ptBR })}
                    </span>
                    <span className="text-sm font-semibold">{format(day, "d")}</span>
                    {isToday && !isSelected && (
                      <span className="size-1 rounded-full bg-brand-orange" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-3">
              {(() => {
                const dayAppts = getDayAppointments(new Date(`${mobileDay}T00:00:00`));
                if (dayAppts.length === 0) {
                  return (
                    <EmptyState
                      icon={CalendarPlus}
                      title="Nenhum agendamento"
                      description="Não há agendamentos neste dia."
                    />
                  );
                }
                return (
                  <div className="flex flex-col gap-2">
                    {groupOverlappingAppointments(dayAppts).map((group) => (
                      <div key={group[0].id} className="flex gap-1.5">
                        {group.map((appt) => (
                          <div key={appt.id} className="flex min-w-0 flex-1 items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <AppointmentChip appt={appt} />
                            </div>
                            <AppointmentStatusBadge status={appt.status} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      <AppointmentDetailsModal
        appointment={detailsAppt}
        onClose={() => setDetailsAppt(null)}
        onChanged={loadAppointments}
      />
    </div>
  );
}
