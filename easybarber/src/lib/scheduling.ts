import {
  appointments,
  getBusinessHoursForDate,
  getWeekdayName,
  professionals,
} from "@/lib/mock-data";
import { hhmmToMinutes, minutesToHHMM } from "@/lib/utils";

const SLOT_STEP_MIN = 15;

/**
 * Calcula os horários disponíveis para um profissional em uma data,
 * considerando horário de funcionamento, jornada do profissional,
 * folgas e agendamentos já existentes. Lógica puramente local —
 * em produção esta verificação também deve ser feita no servidor.
 */
export function getAvailableSlots(
  dateStr: string,
  professionalId: string,
  durationMin: number,
): string[] {
  const hours = getBusinessHoursForDate(dateStr);
  if (!hours.open || durationMin <= 0) return [];

  const professional = professionals.find((p) => p.id === professionalId);
  if (!professional || !professional.active) return [];

  const weekday = getWeekdayName(dateStr);
  if (professional.daysOff.includes(weekday)) return [];

  const openMin = Math.max(
    hhmmToMinutes(hours.start),
    hhmmToMinutes(professional.workHours.start),
  );
  const closeMin = Math.min(
    hhmmToMinutes(hours.end),
    hhmmToMinutes(professional.workHours.end),
  );

  const existing = appointments.filter(
    (a) =>
      a.date === dateStr &&
      a.professionalId === professionalId &&
      a.status !== "cancelado",
  );

  const slots: string[] = [];
  for (let start = openMin; start + durationMin <= closeMin; start += SLOT_STEP_MIN) {
    const end = start + durationMin;
    const conflicts = existing.some((a) => {
      const aStart = hhmmToMinutes(a.startTime);
      const aEnd = hhmmToMinutes(a.endTime);
      return start < aEnd && end > aStart;
    });
    if (!conflicts) slots.push(minutesToHHMM(start));
  }
  return slots;
}
