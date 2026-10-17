"use client";

import { useRealtimeTable } from "@/lib/hooks/useRealtimeTable";

/**
 * Calls `onChange` whenever an appointment is inserted, updated, or
 * cancelled — own company only, enforced by appointments_select RLS
 * (see 20260101000030_appointments_realtime.sql). See useRealtimeTable
 * for the underlying mechanism (tab-refocus fallback included).
 */
export function useAppointmentsRealtime(onChange: () => void) {
  useRealtimeTable("appointments", undefined, onChange);
}
