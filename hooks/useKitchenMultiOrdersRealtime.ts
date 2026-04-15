"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { MenuCourse, OrderStatus } from "@/lib/database.types";
import type { OrderWithRelations } from "@/hooks/useOrdersRealtime";

function normalizeRow(raw: Record<string, unknown>): OrderWithRelations {
  const menu_items = raw.menu_items as { label: string } | null | undefined;
  const banquet_tables = raw.banquet_tables as { name: string } | null | undefined;
  const courseRaw = raw.course as string | undefined;
  const course: MenuCourse =
    courseRaw === "starter" || courseRaw === "dessert" ? courseRaw : "main";
  return {
    id: String(raw.id),
    event_id: String(raw.event_id),
    table_id: String(raw.table_id),
    seat_number: Number(raw.seat_number),
    menu_item_id: String(raw.menu_item_id),
    course,
    special_wishes: (raw.special_wishes as string | null) ?? null,
    status: raw.status as OrderStatus,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    menu_items: menu_items ?? null,
    banquet_tables: banquet_tables ?? null,
  };
}

export type RealtimeMultiState = "connecting" | "subscribed" | "disconnected" | "error";

function channelSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return String(Math.random()).slice(2);
}

export function useKitchenMultiOrdersRealtime(eventIds: string[]) {
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeMultiState>("connecting");
  const [realtimeMessage, setRealtimeMessage] = useState<string | null>(null);

  const key = eventIds.slice().sort().join(",");

  const byEventThenTable = useMemo(() => {
    const map = new Map<string, Map<string, OrderWithRelations[]>>();
    for (const o of orders) {
      const evMap = map.get(o.event_id) ?? new Map<string, OrderWithRelations[]>();
      const list = evMap.get(o.table_id) ?? [];
      list.push(o);
      evMap.set(o.table_id, list);
      map.set(o.event_id, evMap);
    }
    for (const evMap of map.values()) {
      for (const list of evMap.values()) {
        list.sort(
          (a, b) =>
            a.seat_number - b.seat_number ||
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      }
    }
    return map;
  }, [orders]);

  const allowedIdsRef = useRef<Set<string>>(new Set());
  const loadRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});

  useEffect(() => {
    const ids = key.length ? key.split(",") : [];
    allowedIdsRef.current = new Set(ids);

    if (ids.length === 0) {
      loadRef.current = async () => {};
      queueMicrotask(() => {
        setOrders([]);
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

    async function load(opts?: { silent?: boolean }) {
      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);
      const { data, error: qError } = await supabase
        .from("orders")
        .select("*, menu_items(label), banquet_tables(name)")
        .in("event_id", ids)
        .neq("status", "served")
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (qError) {
        setError(qError.message);
        setOrders([]);
      } else {
        setOrders((data ?? []).map((r) => normalizeRow(r as Record<string, unknown>)));
      }
      if (!opts?.silent) {
        setLoading(false);
      }
    }

    loadRef.current = load;

    void load();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    const pollMs = 25_000;
    const pollTimer = window.setInterval(() => {
      if (cancelled || document.visibilityState !== "visible") return;
      void load({ silent: true });
    }, pollMs);

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
      const channelName = `kitchen-multi:${eid}:${channelSuffix()}`;
      const ch = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `event_id=eq.${eid}`,
          },
          async (payload) => {
            const allowed = allowedIdsRef.current;
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as { id?: string } | null;
              if (oldRow?.id) {
                setOrders((prev) => prev.filter((o) => o.id !== String(oldRow.id)));
              }
              return;
            }

            const incoming = payload.new as {
              id?: string;
              table_id?: string;
              status?: OrderStatus;
              event_id?: string;
            } | null;
            if (!incoming?.id || !incoming.event_id) return;
            if (!allowed.has(incoming.event_id)) return;
            if (incoming.status === "served") {
              setOrders((prev) => prev.filter((o) => o.id !== String(incoming.id)));
              return;
            }

            const { data, error: oneErr } = await supabase
              .from("orders")
              .select("*, menu_items(label), banquet_tables(name)")
              .eq("id", incoming.id)
              .maybeSingle();

            if (cancelled || oneErr || !data) return;

            const row = normalizeRow(data as Record<string, unknown>);
            if (row.status === "served") {
              setOrders((prev) => prev.filter((o) => o.id !== row.id));
              return;
            }

            setOrders((prev) => {
              const idx = prev.findIndex((o) => o.id === row.id);
              if (idx === -1) {
                return [...prev, row].sort(
                  (a, b) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      for (const ch of channelRefs) {
        void supabase.removeChannel(ch);
      }
      setRealtimeState("disconnected");
      setRealtimeMessage(null);
    };
  }, [key]);

  const refetch = useCallback((opts?: { silent?: boolean }) => {
    return loadRef.current(opts);
  }, []);

  return { orders, byEventThenTable, loading, error, realtimeState, realtimeMessage, refetch };
}
