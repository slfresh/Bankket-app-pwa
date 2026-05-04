"use client";

import {
  useCallback,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  useEffect,
} from "react";
import { useKitchenMultiOrdersRealtime } from "@/hooks/useKitchenMultiOrdersRealtime";
import { useKitchenNewOrderPing } from "@/hooks/useKitchenNewOrderPing";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSeatGuestNotesForEvents } from "@/hooks/useSeatGuestNotesRealtime";
import { menuCourseSortIndex } from "@/lib/domain/menu-course";
import {
  isKitchenSoundMuted,
  primeKitchenAudio,
  setKitchenSoundMuted,
} from "@/lib/kitchen/play-beep";
import { toast as sonnerToast } from "sonner";
import { advanceOrderStatus } from "@/lib/actions/kitchen";
import { RealtimeConnectionBanner } from "@/components/staff/RealtimeConnectionBanner";
import { PageOfflineBanner } from "@/components/staff/PageOfflineBanner";
import type { OrderWithRelations } from "@/hooks/useOrdersRealtime";
import { useReadyFlash } from "@/hooks/useReadyFlash";
import { KitchenTableTicket } from "@/components/kitchen/KitchenTableTicket";
import { guestFingerprintForTableRows } from "@/lib/kitchen/order-board-utils";

type EventMeta = { id: string; name: string };

type StatusFilter = "all" | "pending" | "cooked";

type KitchenOptimisticPatch =
  | { orderId: string; nextStatus: "cooked" | "served" }
  | { type: "bulk_cooked"; orderIds: string[] };

export function KitchenMultiBoard({ events }: { events: EventMeta[] }) {
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const nameByEventId = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of events) m.set(e.id, e.name);
    return m;
  }, [events]);

  const { orders, loading, error, realtimeState, realtimeMessage, refetch } =
    useKitchenMultiOrdersRealtime(eventIds);

  const [displayOrders, applyKitchenOptimistic] = useOptimistic(
    orders,
    (current, patch: KitchenOptimisticPatch) => {
      if ("type" in patch && patch.type === "bulk_cooked") {
        const set = new Set(patch.orderIds);
        return current.map((o) =>
          set.has(o.id) && o.status === "pending"
            ? { ...o, status: "cooked" as const, updated_at: new Date().toISOString() }
            : o,
        );
      }
      const p = patch as { orderId: string; nextStatus: "cooked" | "served" };
      if (p.nextStatus === "served") {
        return current.filter((o) => o.id !== p.orderId);
      }
      return current.map((o) =>
        o.id === p.orderId
          ? { ...o, status: "cooked" as const, updated_at: new Date().toISOString() }
          : o,
      );
    },
  );

  const {
    byEventTableSeat,
    loading: notesLoading,
    error: notesError,
  } = useSeatGuestNotesForEvents(eventIds);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [soundMuted, setSoundMuted] = useState(false);
  const { readyFlashOrderIds, flashReadyIds } = useReadyFlash();
  const online = useOnlineStatus();

  useEffect(() => {
    setSoundMuted(isKitchenSoundMuted());
  }, []);

  const pendingOnly = useMemo(
    () => displayOrders.filter((o) => o.status === "pending"),
    [displayOrders],
  );
  const { toast, dismissToast, liveRegionText } = useKitchenNewOrderPing(pendingOnly);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return displayOrders;
    return displayOrders.filter((o) => o.status === statusFilter);
  }, [displayOrders, statusFilter]);

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

  const advance = useCallback(
    (orderId: string, nextStatus: "cooked" | "served") => {
      startTransition(async () => {
        setPendingId(orderId);
        applyKitchenOptimistic({ orderId, nextStatus });
        const res = await advanceOrderStatus({ orderId, nextStatus });
        setPendingId(null);
        if ("error" in res) {
          const msg = res.error ?? "Something went wrong. Please try again.";
          sonnerToast.error(msg);
          throw new Error(msg);
        }
        if (nextStatus === "cooked") {
          flashReadyIds([orderId]);
        }
      });
    },
    [applyKitchenOptimistic, flashReadyIds],
  );

  const advanceCoursePending = useCallback(
    (orderIds: string[]) => {
      const ids = orderIds.filter(Boolean);
      if (ids.length === 0) return;
      startTransition(async () => {
        applyKitchenOptimistic({ type: "bulk_cooked", orderIds: ids });
        const results = await Promise.all(
          ids.map((orderId) => advanceOrderStatus({ orderId, nextStatus: "cooked" })),
        );
        const failed = results.find((r) => "error" in r) as { error?: string } | undefined;
        if (failed && "error" in failed) {
          const msg = failed.error ?? "Something went wrong. Please try again.";
          sonnerToast.error(msg);
          throw new Error(msg);
        }
        flashReadyIds(ids);
      });
    },
    [applyKitchenOptimistic, flashReadyIds],
  );

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
      className="relative pb-[max(7rem,env(safe-area-inset-bottom,0px)+5.5rem)] sm:pb-[max(8rem,env(safe-area-inset-bottom,0px)+6rem)]"
      onPointerDown={() => {
        primeKitchenAudio();
      }}
    >
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveRegionText}
      </div>
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
      <div className="mt-2">
        <PageOfflineBanner online={online} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "pending", "cooked"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
              statusFilter === key
                ? "bg-accent text-accent-foreground"
                : "border border-border-kitchen bg-surface-kitchen-elevated text-zinc-300"
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
              <ul className="grid list-none gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {tableEntries.map(([tableId, rows]) => {
                  const tableName = rows[0]?.banquet_tables?.name ?? "Table";
                  return (
                    <li key={`${eventId}:${tableId}`} className="list-none">
                      <KitchenTableTicket
                        eventId={eventId}
                        tableId={tableId}
                        tableName={tableName}
                        rows={rows}
                        guestFingerprint={guestFingerprintForTableRows(tableId, rows, (_tid, seat) =>
                          byEventTableSeat.get(`${eventId}:${tableId}:${seat}`)?.trim() ?? "",
                        )}
                        guestNotice={(seat) =>
                          byEventTableSeat.get(`${eventId}:${tableId}:${seat}`)?.trim() || null
                        }
                        advance={advance}
                        advanceCoursePending={advanceCoursePending}
                        pendingId={pendingId}
                        isPending={isPending}
                        readyFlashOrderIds={readyFlashOrderIds}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {!loadingBoard && filteredOrders.length === 0 ? (
        <p className="mt-10 text-2xl text-neutral-500">
          {displayOrders.length === 0
            ? "No open orders for these events."
            : "No orders in this filter."}
        </p>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-kitchen bg-surface-kitchen/95 px-2 py-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-12px_32px_rgba(0,0,0,0.55)] backdrop-blur-md supports-[backdrop-filter]:bg-surface-kitchen/90 sm:px-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500/90">
          Totals (current filter, all events)
        </p>
        {mealTotals.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">No meals in this filter.</p>
        ) : (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-lg font-semibold text-white">
            {mealTotals.map(([label, count]) => (
              <span key={label} className="tabular-nums">
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
