"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderStatus } from "@/lib/database.types";
import {
  normalizeOrderRow,
  type OrderWithRelations,
} from "@/lib/orders/order-with-relations";

export type { OrderWithRelations };

export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "subscribed"
  | "disconnected"
  | "error";

type UseOrdersRealtimeOptions = {
  eventId: string;
  tableId?: string;
  /**
   * Waiter table view: keep `served` rows so seats can show a solid “served” state.
   * Kitchen views should omit this (default).
   */
  includeServed?: boolean;
};

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

export function useOrdersRealtime({ eventId, tableId, includeServed = false }: UseOrdersRealtimeOptions) {
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("connecting");
  const [realtimeMessage, setRealtimeMessage] = useState<string | null>(null);
  const loadOrdersRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load(opts?: { silent?: boolean }) {
      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);
      let query = supabase
        .from("orders")
        .select("*, menu_items(label), banquet_tables(name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (!includeServed) {
        query = query.neq("status", "served");
      }

      if (tableId) {
        query = query.eq("table_id", tableId);
      }

      const { data, error: qError } = await query;
      if (cancelled) {
        return;
      }
      if (qError) {
        setError(qError.message);
        setOrders([]);
      } else {
        setOrders((data ?? []).map((r) => normalizeOrderRow(r as Record<string, unknown>)));
      }
      if (!opts?.silent) {
        setLoading(false);
      }
    }

    loadOrdersRef.current = load;

    void load();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    /** Safety net if the Realtime socket stalls (background tabs, flaky Wi‑Fi). */
    const pollMs = 25_000;
    const pollTimer = window.setInterval(() => {
      if (cancelled || document.visibilityState !== "visible") return;
      void load({ silent: true });
    }, pollMs);

    const channelName = tableId
      ? `orders:${eventId}:table:${tableId}${includeServed ? ":served" : ""}`
      : `orders:${eventId}:kitchen`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
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
          } | null;
          if (!incoming?.id) {
            return;
          }
          if (tableId && incoming.table_id !== tableId) {
            return;
          }
          if (incoming.status === "served" && !includeServed) {
            setOrders((prev) => prev.filter((o) => o.id !== String(incoming.id)));
            return;
          }

          const { data, error: oneErr } = await supabase
            .from("orders")
            .select("*, menu_items(label), banquet_tables(name)")
            .eq("id", incoming.id)
            .maybeSingle();

          if (cancelled || oneErr || !data) {
            return;
          }

          const row = normalizeOrderRow(data as Record<string, unknown>);
          if (row.status === "served" && !includeServed) {
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
      .subscribe((status, err) => {
        if (cancelled) return;
        const { state, message } = mapChannelStatus(status, err);
        setRealtimeState(state);
        setRealtimeMessage(message);
      });

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
      setRealtimeState("idle");
      setRealtimeMessage(null);
    };
  }, [eventId, tableId, includeServed]);

  const refetch = useCallback((opts?: { silent?: boolean }) => {
    return loadOrdersRef.current(opts);
  }, []);

  const byTableId = useMemo(() => {
    const map = new Map<string, OrderWithRelations[]>();
    for (const o of orders) {
      const list = map.get(o.table_id) ?? [];
      list.push(o);
      map.set(o.table_id, list);
    }
    return map;
  }, [orders]);

  return { orders, byTableId, loading, error, realtimeState, realtimeMessage, refetch };
}
