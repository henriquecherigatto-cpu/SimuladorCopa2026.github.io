"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Calls `onChange` whenever an appointment is inserted, updated, or
 * cancelled (own company only — Realtime evaluates the same RLS policy
 * as any other read, see 20260101000030_appointments_realtime.sql), and
 * again whenever the tab regains focus, since a backgrounded tab's
 * websocket can silently drop without the app noticing. Kept in a ref
 * so callers can pass a callback that changes identity (e.g. one
 * closing over the current date range) without tearing down and
 * reopening the socket on every render.
 */
export function useAppointmentsRealtime(onChange: () => void) {
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      // This client instance is brand new, so its Realtime connection
      // doesn't know who's logged in yet — without explicitly syncing
      // the session's JWT first, the server authorizes the subscription
      // as "anon" and RLS silently drops every change event instead of
      // erroring, since appointments_select only grants to authenticated.
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel("appointments-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "appointments" },
          () => onChangeRef.current(),
        )
        .subscribe();
    });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") onChangeRef.current();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
}
