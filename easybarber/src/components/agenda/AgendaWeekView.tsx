"use client";

import * as React from "react";
import { addDays, addWeeks, format, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { AppointmentStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppointmentDetailsModal } from "@/components/agenda/AppointmentDetailsModal";
import {
  getAppointmentsByDate,
  getCustomerById,
  getProfessionalById,
  getServiceById,
  professionals,
  todayDate,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types";

function toISODate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function AgendaWeekView() {
  const [weekStart, setWeekStart] = React.useState(() =>
    startOfWeek(todayDate, { weekStartsOn: 1 }),
  );
  const [activeProfessional, setActiveProfessional] = React.useState<
    string | "todos"
  >("todos");
  const [mobileDay, setMobileDay] = React.useState(() => toISODate(todayDate));
  const [detailsAppt, setDetailsAppt] = React.useState<Appointment | null>(
    null,
  );

  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const activeProfessionals = professionals.filter((p) => p.active);

  const getDayAppointments = (date: Date) =>
    getAppointmentsByDate(toISODate(date)).filter(
      (a) => activeProfessional === "todos" || a.professionalId === activeProfessional,
    );

  const weekLabel = `${format(days[0], "d 'de' MMM", { locale: ptBR })} – ${format(days[6], "d 'de' MMM", { locale: ptBR })}`;

  const AppointmentChip = ({ appt }: { appt: Appointment }) => {
    const customer = getCustomerById(appt.customerId);
    const service = getServiceById(appt.serviceId);
    const professional = getProfessionalById(appt.professionalId);
    return (
      <button
        onClick={() => setDetailsAppt(appt)}
        style={{
          borderLeftColor: professional?.color ?? "#FF6B1A",
          backgroundColor: `${professional?.color ?? "#FF6B1A"}14`,
        }}
        className={cn(
          "flex w-full flex-col gap-0.5 rounded-lg border-l-4 px-2.5 py-1.5 text-left transition-opacity hover:opacity-80",
          appt.status === "cancelado" && "opacity-50",
        )}
      >
        <span className="truncate text-xs font-semibold text-brand-graphite">
          {appt.startTime} · {customer?.name}
        </span>
        <span className="truncate text-[11px] text-brand-graphite/60">
          {service?.name}
        </span>
      </button>
    );
  };

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
            onClick={() => setWeekStart(startOfWeek(todayDate, { weekStartsOn: 1 }))}
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
        {activeProfessionals.map((prof) => (
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

      {/* Desktop: 7-column grid */}
      <div className="hidden grid-cols-7 gap-3 sm:grid">
        {days.map((day) => {
          const isToday = isSameDay(day, todayDate);
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
                  dayAppts.map((appt) => (
                    <AppointmentChip key={appt.id} appt={appt} />
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
            const isToday = isSameDay(day, todayDate);
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
            const dayAppts = getDayAppointments(
              new Date(`${mobileDay}T00:00:00`),
            );
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
                {dayAppts.map((appt) => (
                  <div key={appt.id} className="flex items-center gap-2">
                    <div className="flex-1">
                      <AppointmentChip appt={appt} />
                    </div>
                    <AppointmentStatusBadge status={appt.status} />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      <AppointmentDetailsModal
        appointment={detailsAppt}
        onClose={() => setDetailsAppt(null)}
      />
    </div>
  );
}
