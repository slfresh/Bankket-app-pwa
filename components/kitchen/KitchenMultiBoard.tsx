"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useKitchenMultiOrdersRealtime } from "@/hooks/useKitchenMultiOrdersRealtime";
import { useKitchenNewOrderPing } from "@/hooks/useKitchenNewOrderPing";
import { useSeatGuestNotesForEvents } from "@/hooks/useSeatGuestNotesRealtime";
import { menuCourseSortIndex, menuCourseTitle } from "@/lib/domain/menu-course";
import {
  isKitchenSoundMuted,
  primeKitchenAudio,
  setKitchenSoundMuted,
} from "@/lib/kitchen/play-beep";
import { advanceOrderStatus } from "@/lib/actions/kitchen";
import { RealtimeConnectionBanner } from "@/components/staff/RealtimeConnectionBanner";
import type { OrderWithRelations } from "@/hooks/useOrdersRealtime";

type EventMeta = { id: string; name: string };

type StatusFilter = "all" | "pending" | "cooked";

export function KitchenMultiBoard({ events }: { events: EventMeta[] }) {
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const nameByEventId = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of events) m.set(e.id, e.name);
    return m;
  }, [events]);

  const { orders, loading, error, realtimeState, realtimeMessage, refetch } =
    useKitchenMultiOrdersRealtime(eventIds);
  const {
    byEventTableSeat,
    loading: notesLoading,
    error: notesError,
  } = useSeatGuestNotesForEvents(eventIds);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    setSoundMuted(isKitchenSoundMuted());
  }, []);

  const pendingOnly = useMemo(
    () => orders.filter((o) => o.status === "pending"),
    [orders],
  );
  const { toast, dismissToast } = useKitchenNewOrderPing(pendingOnly);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const filteredByEventTable = useMemo(() => {
    const map = new Map<string, Map<string, OrderWithRelations[]>>();
    for (const o of filteredOrders) {
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
            menuCourseSortIndex(a.course) - menuCourseSortIndex(b.course) ||
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      }
    }
    return map;
  }, [filteredOrders]);

  const mealTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of filteredOrders) {
      const label = o.menu_items?.label ?? "—";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [filteredOrders]);

  const advance = useCallback((orderId: string, nextStatus: "cooked" | "served") => {
    startTransition(async () => {
      setRpcError(null);
      setPendingId(orderId);
      const res = await advanceOrderStatus({ orderId, nextStatus });
      setPendingId(null);
      if ("error" in res) {
        setRpcError(res.error ?? "Something went wrong. Please try again.");
      }
    });
  }, []);

  const sortedEventIds = useMemo(
    () =>
      Array.from(filteredByEventTable.keys()).sort((a, b) =>
        (nameByEventId.get(a) ?? "").localeCompare(nameByEventId.get(b) ?? ""),
      ),
    [filteredByEventTable, nameByEventId],
  );

  const loadingBoard = loading || notesLoading;

  if (events.length === 0) {
    return (
      <p className="mt-8 text-xl text-neutral-500">No events in this view — nothing to show yet.</p>
    );
  }

  return (
    <div
      className="relative pb-28 sm:pb-32"
      onPointerDown={() => {
        primeKitchenAudio();
      }}
    >
      {toast ? (
        <div className="fixed left-1/2 top-20 z-[100] w-[min(100%,24rem)] -translate-x-1/2 px-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-600/60 bg-amber-950 px-4 py-3 text-amber-50 shadow-lg">
            <p className="text-sm font-semibold">{toast}</p>
            <button type="button" className="text-sm underline" onClick={() => dismissToast()}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-2 pt-2 sm:px-6">
        <button
          type="button"
          className="rounded-lg border border-neutral-600 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
          onClick={() => {
            primeKitchenAudio();
            const next = !soundMuted;
            setSoundMuted(next);
            setKitchenSoundMuted(next);
          }}
        >
          {soundMuted ? "Unmute new-order sound" : "Mute new-order sound"}
        </button>
      </div>
      <div className="p-4 pt-0 sm:p-6 sm:pt-0">
      <RealtimeConnectionBanner
        variant="kitchen"
        realtimeState={realtimeState}
        realtimeMessage={realtimeMessage}
        onRefresh={() => void refetch({ silent: true })}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "pending", "cooked"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
              statusFilter === key
                ? "bg-white text-neutral-950"
                : "border border-neutral-700 bg-neutral-900 text-neutral-300"
            }`}
          >
            {key === "cooked" ? "Cooking" : key}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-950 px-4 py-3 text-lg text-red-200">{error}</p>
      ) : null}
      {notesError ? (
        <p className="mb-4 rounded-lg bg-red-950 px-4 py-3 text-lg text-red-200">
          Guest notes: {notesError}
        </p>
      ) : null}
      {rpcError ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-950 px-4 py-3 text-lg text-red-200">
          {rpcError}
        </p>
      ) : null}
      {loadingBoard ? (
        <p className="text-xl text-neutral-500">Loading combined board…</p>
      ) : null}

      <div className="space-y-10">
        {sortedEventIds.map((eventId) => {
          const evName = nameByEventId.get(eventId) ?? "Event";
          const tablesMap = filteredByEventTable.get(eventId);
          if (!tablesMap?.size) return null;
          const tableEntries = Array.from(tablesMap.entries()).sort((a, b) =>
            (a[1][0]?.banquet_tables?.name ?? "Table").localeCompare(
              b[1][0]?.banquet_tables?.name ?? "Table",
            ),
          );
          return (
            <section key={eventId}>
              <h2 className="mb-4 border-b border-neutral-700 pb-2 text-2xl font-bold text-white">
                {evName}
              </h2>
              <div className="grid gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {tableEntries.map(([tableId, rows]) => {
                  const tableName = rows[0]?.banquet_tables?.name ?? "Table";
                  return (
                    <section
                      key={tableId}
                      className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-inner"
                    >
                      <h3 className="border-b border-neutral-800 pb-3 text-xl font-semibold text-white">
                        {tableName}
                      </h3>
                      <ul className="mt-4 space-y-4">
                        {rows.map((o) => {
                          const guestLine = byEventTableSeat
                            .get(`${eventId}:${tableId}:${o.seat_number}`)
                            ?.trim();
                          return (
                          <li
                            key={o.id}
                            className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-2xl font-bold text-white">Seat {o.seat_number}</p>
                                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                                  {menuCourseTitle(o.course)}
                                </p>
                                <p className="text-xl font-medium text-amber-100">
                                  {o.menu_items?.label ?? "—"}
                                </p>
                                {guestLine ? (
                                  <div className="mt-2 rounded-md border border-red-900/50 bg-red-950/40 px-2 py-1.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-red-400">
                                      Guest · allergies · all courses
                                    </p>
                                    <p className="mt-0.5 text-sm font-semibold leading-snug text-red-200">
                                      {guestLine}
                                    </p>
                                  </div>
                                ) : null}
                                {o.special_wishes ? (
                                  <div className="mt-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                      This plate only
                                    </p>
                                    <p className="mt-0.5 text-sm leading-snug text-neutral-400">
                                      {o.special_wishes}
                                    </p>
                                  </div>
                                ) : null}
                                <p className="mt-3 text-sm uppercase tracking-widest text-neutral-500">
                                  {o.status}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3">
                              {o.status === "pending" ? (
                                <button
                                  type="button"
                                  disabled={isPending && pendingId === o.id}
                                  onClick={() => advance(o.id, "cooked")}
                                  className="min-h-[48px] flex-1 rounded-xl bg-amber-500 px-4 py-3 text-lg font-semibold text-neutral-950 disabled:opacity-50"
                                >
                                  Cooked
                                </button>
                              ) : null}
                              {o.status === "cooked" ? (
                                <button
                                  type="button"
                                  disabled={isPending && pendingId === o.id}
                                  onClick={() => advance(o.id, "served")}
                                  className="min-h-[48px] flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-lg font-semibold text-neutral-950 disabled:opacity-50"
                                >
                                  Served
                                </button>
                              ) : null}
                            </div>
                          </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {!loadingBoard && filteredOrders.length === 0 ? (
        <p className="mt-10 text-2xl text-neutral-500">
          {orders.length === 0
            ? "No open orders for these events."
            : "No orders in this filter."}
        </p>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950 px-2 py-4 shadow-[0_-12px_32px_rgba(0,0,0,0.55)] sm:px-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500/90">
          Totals (current filter, all events)
        </p>
        {mealTotals.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">No meals in this filter.</p>
        ) : (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-lg font-semibold text-white">
            {mealTotals.map(([label, count]) => (
              <span key={label}>
                {count}× {label}
              </span>
            ))}
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
