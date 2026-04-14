"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeConnectionState } from "@/hooks/useOrdersRealtime";

function mapChannelStatus(
  status: string,
  err: Error | undefined,
): { state: RealtimeConnectionState; message: string | null } {
  switch (status) {
    case "SUBSCRIBED":
      return { state: "subscribed", message: null };
    case "CHANNEL_ERROR":
      return {
        state: "error",
        message: err?.message ?? "Realtime channel error. Check your connection.",
      };
    case "TIMED_OUT":
      return { state: "error", message: "Realtime connection timed out." };
    case "CLOSED":
      return { state: "disconnected", message: null };
    default:
      return { state: "connecting", message: null };
  }
}

export type SeatGuestNoteRow = {
  id: string;
  event_id: string;
  table_id: string;
  seat_number: number;
  kitchen_notice: string | null;
  updated_at: string;
};

function normalizeNote(raw: Record<string, unknown>): SeatGuestNoteRow {
  return {
    id: String(raw.id),
    event_id: String(raw.event_id),
    table_id: String(raw.table_id),
    seat_number: Number(raw.seat_number),
    kitchen_notice: (raw.kitchen_notice as string | null) ?? null,
    updated_at: String(raw.updated_at),
  };
}

/** Waiter: notes for one table (realtime on table_id). */
export function useSeatGuestNotesForTable(eventId: string, tableId: string) {
  const [notes, setNotes] = useState<SeatGuestNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("connecting");
  const [realtimeMessage, setRealtimeMessage] = useState<string | null>(null);
  const loadRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load(opts?: { silent?: boolean }) {
      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);
      const { data, error: qError } = await supabase
        .from("seat_guest_notes")
        .select("*")
        .eq("table_id", tableId)
        .eq("event_id", eventId);

      if (cancelled) return;
      if (qError) {
        setError(qError.message);
        setNotes([]);
      } else {
        setNotes((data ?? []).map((r) => normalizeNote(r as Record<string, unknown>)));
      }
      if (!opts?.silent) {
        setLoading(false);
      }
    }

    loadRef.current = load;
    void load();

    const channelName = `seat_notes:table:${tableId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "seat_guest_notes",
          filter: `table_id=eq.${tableId}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id?: string } | null;
            if (oldRow?.id) {
              setNotes((prev) => prev.filter((n) => n.id !== String(oldRow.id)));
            }
            return;
          }

          const incoming = payload.new as { id?: string; event_id?: string } | null;
          if (!incoming?.id || incoming.event_id !== eventId) {
            return;
          }

          const { data, error: oneErr } = await supabase
            .from("seat_guest_notes")
            .select("*")
            .eq("id", incoming.id)
            .maybeSingle();

          if (cancelled || oneErr || !data) return;

          const row = normalizeNote(data as Record<string, unknown>);
          setNotes((prev) => {
            const idx = prev.findIndex((n) => n.id === row.id);
            if (idx === -1) {
              return [...prev, row].sort((a, b) => a.seat_number - b.seat_number);
            }
            const next = [...prev];
            next[idx] = row;
            return next;
          });
        },
      )
      .subscribe((status, err) => {
        if (cancelled) return;
        const { state, message } = mapChannelStatus(status, err);
        setRealtimeState(state);
        setRealtimeMessage(message);
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      setRealtimeState("idle");
      setRealtimeMessage(null);
    };
  }, [eventId, tableId]);

  const refetch = useCallback((opts?: { silent?: boolean }) => {
    return loadRef.current(opts);
  }, []);

  const bySeatNumber = useMemo(() => {
    const map = new Map<number, SeatGuestNoteRow>();
    for (const n of notes) {
      map.set(n.seat_number, n);
    }
    return map;
  }, [notes]);

  return { notes, bySeatNumber, loading, error, realtimeState, realtimeMessage, refetch };
}

/** Kitchen: all notes for one event. */
export function useSeatGuestNotesForEvent(eventId: string) {
  const [notes, setNotes] = useState<SeatGuestNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("connecting");
  const [realtimeMessage, setRealtimeMessage] = useState<string | null>(null);
  const loadRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load(opts?: { silent?: boolean }) {
      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);
      const { data, error: qError } = await supabase
        .from("seat_guest_notes")
        .select("*")
        .eq("event_id", eventId);

      if (cancelled) return;
      if (qError) {
        setError(qError.message);
        setNotes([]);
      } else {
        setNotes((data ?? []).map((r) => normalizeNote(r as Record<string, unknown>)));
      }
      if (!opts?.silent) {
        setLoading(false);
      }
    }

    loadRef.current = load;
    void load();

    const channelName = `seat_notes:event:${eventId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "seat_guest_notes",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id?: string } | null;
            if (oldRow?.id) {
              setNotes((prev) => prev.filter((n) => n.id !== String(oldRow.id)));
            }
            return;
          }

          const incoming = payload.new as { id?: string } | null;
          if (!incoming?.id) return;

          const { data, error: oneErr } = await supabase
            .from("seat_guest_notes")
            .select("*")
            .eq("id", incoming.id)
            .maybeSingle();

          if (cancelled || oneErr || !data) return;

          const row = normalizeNote(data as Record<string, unknown>);
          setNotes((prev) => {
            const idx = prev.findIndex((n) => n.id === row.id);
            if (idx === -1) {
              return [...prev, row].sort(
                (a, b) =>
                  a.table_id.localeCompare(b.table_id) || a.seat_number - b.seat_number,
              );
            }
            const next = [...prev];
            next[idx] = row;
            return next;
          });
        },
      )
      .subscribe((status, err) => {
        if (cancelled) return;
        const { state, message } = mapChannelStatus(status, err);
        setRealtimeState(state);
        setRealtimeMessage(message);
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      setRealtimeState("idle");
      setRealtimeMessage(null);
    };
  }, [eventId]);

  const refetch = useCallback((opts?: { silent?: boolean }) => {
    return loadRef.current(opts);
  }, []);

  const byTableAndSeat = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const n of notes) {
      const key = `${n.table_id}:${n.seat_number}`;
      map.set(key, n.kitchen_notice);
    }
    return map;
  }, [notes]);

  return { notes, byTableAndSeat, loading, error, realtimeState, realtimeMessage, refetch };
}

function channelSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return String(Math.random()).slice(2);
}

/** Combined kitchen board: notes across several events. */
export function useSeatGuestNotesForEvents(eventIds: string[]) {
  const [notes, setNotes] = useState<SeatGuestNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("connecting");
  const [realtimeMessage, setRealtimeMessage] = useState<string | null>(null);

  const key = eventIds.slice().sort().join(",");
  const allowedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ids = key.length ? key.split(",") : [];
    allowedIdsRef.current = new Set(ids);

    if (ids.length === 0) {
      queueMicrotask(() => {
        setNotes([]);
        setLoading(false);
        setRealtimeState("subscribed");
      });
      return;
    }

    const supabase = createClient();
    let cancelled = false;
    const channelRefs: RealtimeChannel[] = [];
    let subscribedCount = 0;
    const needSubscribe = ids.length;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: qError } = await supabase
        .from("seat_guest_notes")
        .select("*")
        .in("event_id", ids);

      if (cancelled) return;
      if (qError) {
        setError(qError.message);
        setNotes([]);
      } else {
        setNotes((data ?? []).map((r) => normalizeNote(r as Record<string, unknown>)));
      }
      setLoading(false);
    }

    void load();

    function onChannelStatus(status: string, err: Error | undefined) {
      if (cancelled) return;
      if (status === "SUBSCRIBED") {
        subscribedCount += 1;
        if (subscribedCount >= needSubscribe) {
          setRealtimeState("subscribed");
          setRealtimeMessage(null);
        }
      } else if (status === "CHANNEL_ERROR") {
        setRealtimeState("error");
        setRealtimeMessage(err?.message ?? "Realtime error.");
      } else if (status === "TIMED_OUT") {
        setRealtimeState("error");
        setRealtimeMessage("Realtime timed out.");
      } else if (status === "CLOSED") {
        setRealtimeState("disconnected");
      }
    }

    for (const eid of ids) {
      const channelName = `seat_notes:multi:${eid}:${channelSuffix()}`;
      const ch = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "seat_guest_notes",
            filter: `event_id=eq.${eid}`,
          },
          async (payload) => {
            const allowed = allowedIdsRef.current;
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as { id?: string } | null;
              if (oldRow?.id) {
                setNotes((prev) => prev.filter((n) => n.id !== String(oldRow.id)));
              }
              return;
            }

            const incoming = payload.new as { id?: string; event_id?: string } | null;
            if (!incoming?.id || !incoming.event_id || !allowed.has(incoming.event_id)) {
              return;
            }

            const { data, error: oneErr } = await supabase
              .from("seat_guest_notes")
              .select("*")
              .eq("id", incoming.id)
              .maybeSingle();

            if (cancelled || oneErr || !data) return;

            const row = normalizeNote(data as Record<string, unknown>);
            setNotes((prev) => {
              const idx = prev.findIndex((n) => n.id === row.id);
              if (idx === -1) {
                return [...prev, row].sort(
                  (a, b) =>
                    a.event_id.localeCompare(b.event_id) ||
                    a.table_id.localeCompare(b.table_id) ||
                    a.seat_number - b.seat_number,
                );
              }
              const next = [...prev];
              next[idx] = row;
              return next;
            });
          },
        )
        .subscribe((status, err) => onChannelStatus(status, err));

      channelRefs.push(ch);
    }

    return () => {
      cancelled = true;
      for (const ch of channelRefs) {
        void supabase.removeChannel(ch);
      }
      setRealtimeState("disconnected");
      setRealtimeMessage(null);
    };
  }, [key]);

  const byEventTableSeat = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const n of notes) {
      map.set(`${n.event_id}:${n.table_id}:${n.seat_number}`, n.kitchen_notice);
    }
    return map;
  }, [notes]);

  return { notes, byEventTableSeat, loading, error, realtimeState, realtimeMessage };
}
