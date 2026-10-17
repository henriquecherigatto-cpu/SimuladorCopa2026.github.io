"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Calls `onChange` whenever a row in `table` changes (optionally
 * narrowed by `filter`, e.g. "company_id=eq.<uuid>" — same syntax as
 * supabase-js's postgres_changes filter), scoped by whatever RLS
 * policy already governs reading that table — a change this session's
 * own user couldn't SELECT never reaches onChange. Also fires on tab
 * refocus, since a backgrounded tab's websocket can silently drop
 * without the app noticing. Kept in a ref so callers can pass a
 * callback that changes identity (e.g. one closing over other state)
 * without tearing down and reopening the socket on every render.
 */
export function useRealtimeTable(
  table: string,
  filter: string | undefined,
  onChange: () => void,
) {
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
      // erroring, since every relevant table's select policy only
      // grants to authenticated.
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel(`${table}-changes${filter ? `-${filter}` : ""}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
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
  }, [table, filter]);
}
