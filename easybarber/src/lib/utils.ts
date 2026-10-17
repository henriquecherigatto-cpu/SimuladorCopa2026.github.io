import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The one timezone appointment-facing date/time arithmetic is pinned
 * to, mirroring public.app_timezone() in
 * supabase/migrations/20260101000022_fix_appointment_timezone.sql —
 * every company on this app is a Brazilian barbershop, so this is a
 * single shared constant rather than a per-company setting. Used
 * wherever a date+time typed by a visitor/owner (their own local wall
 * clock) needs to become an absolute instant, or an absolute instant
 * needs to be shown back as that same wall-clock time — see
 * createAppointment() and listAppointmentsInRange()
 * (src/lib/actions/appointments.ts) and sendBookingConfirmation()
 * (src/lib/actions/public-booking.ts).
 */
export const APP_TIMEZONE = "America/Sao_Paulo";

/**
 * Portuguese weekday labels, indexed exactly like Postgres'
 * business_hours.day_of_week / extract(dow from ...) and JS's
 * Date#getDay() — 0 is Domingo (Sunday), 6 is Sábado (Saturday). The
 * one canonical list so a day-of-week index always maps to the same
 * label everywhere (Configurações' business-hours editor,
 * Profissionais' weekly days-off picker) instead of two copies
 * silently drifting apart.
 */
export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/**
 * Single-letter weekday abbreviations, derived from WEEKDAY_LABELS so
 * the two never drift apart — e.g. index-aligned, Monday-first display
 * order [1,2,3,4,5,6,0] reads "S T Q Q S S D". Used by the Agenda's
 * week strip and its mini-calendar date picker.
 */
export const WEEKDAY_LETTERS = WEEKDAY_LABELS.map((label) => label[0]);

/**
 * "Today", as a YYYY-MM-DD string, in the business's own timezone —
 * never the runtime's system clock. A plain `new Date()` rendered as
 * a calendar date disagrees with itself between the server (this
 * container runs in UTC) and a browser in Brazil for several hours
 * every day (e.g. 21:30 in São Paulo is already past midnight UTC),
 * which both mis-defaults "today" in the UI and triggers a
 * server/client hydration mismatch. Used anywhere agenda UI needs
 * "today" as a default/comparison value — see AgendaDayView,
 * TimeBlockManager, NewAppointmentForm.
 */
export function todayISOInAppTimezone(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

/** Same as todayISOInAppTimezone(), as a local-midnight Date object — for date-fns functions (startOfWeek, isSameDay) that expect a Date. */
export function todayInAppTimezone(): Date {
  return new Date(`${todayISOInAppTimezone()}T00:00:00`);
}

export function formatCurrencyBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Normalizes a phone number to digits-only, with the 55 country code
 * prefixed when missing. Assumes a Brazilian number since that's the
 * only market this app serves today. Shared by buildWhatsAppLink()
 * (a wa.me link, for a human to click) and the WhatsApp provider
 * adapter (src/lib/whatsapp/meta-cloud-api.ts, an actual API call) so
 * both normalize a visitor-typed phone number the exact same way.
 */
export function toWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/**
 * Builds a wa.me deep link that opens a chat with the given phone
 * number.
 */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const base = `https://wa.me/${toWhatsAppDigits(phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Builds a Google Calendar "add event" deep link (calendar.google.com
 * TEMPLATE action) — no auth or API key needed, it just pre-fills the
 * event creation form for whoever opens it.
 */
export function buildGoogleCalendarLink(input: {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
}): string {
  const toUtcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${toUtcStamp(input.start)}/${toUtcStamp(input.end)}`,
  });
  if (input.description) params.set("details", input.description);
  if (input.location) params.set("location", input.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
