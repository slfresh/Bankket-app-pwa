"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useKitchenNewOrderPing } from "@/hooks/useKitchenNewOrderPing";
import { useOrdersRealtime, type OrderWithRelations } from "@/hooks/useOrdersRealtime";
import { useReadyFlash } from "@/hooks/useReadyFlash";
import { useSeatGuestNotesForEvent } from "@/hooks/useSeatGuestNotesRealtime";
import { menuCourseSortIndex } from "@/lib/domain/menu-course";
import {
  cookedOrdersByTable,
  groupOrdersByTable,
  guestFingerprintForTableRows,
  oldestPendingTime,
} from "@/lib/kitchen/order-board-utils";
import {
  isKitchenSoundMuted,
  primeKitchenAudio,
  setKitchenSoundMuted,
} from "@/lib/kitchen/play-beep";
import { toast as sonnerToast } from "sonner";
import { advanceOrderStatus } from "@/lib/actions/kitchen";
import { RealtimeConnectionBanner } from "@/components/staff/RealtimeConnectionBanner";
import { createClient } from "@/lib/supabase/client";
import {
  KitchenEventFloor,
  type KitchenFloorTableRow,
} from "@/components/kitchen/KitchenEventFloor";
import { KitchenTableTicket } from "@/components/kitchen/KitchenTableTicket";

type KitchenBoardProps = {
  eventId: string;
  eventName: string;
};

type StatusFilter = "all" | "pending" | "cooked";

const VF_THRESHOLD = 50;

const STATUS_FILTER_KEYS: readonly StatusFilter[] = ["all", "pending", "cooked"] as const;
const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  pending: "Pending",
  cooked: "Cooking",
};
/** Short hints shown under the label (big-screen readability). */
const STATUS_FILTER_HINTS: Record<StatusFilter, string> = {
  all: "every open ticket",
  pending: "waiting to be cooked",
  cooked: "plated, awaiting pickup",
};

type KitchenOptimisticPatch =
  | { orderId: string; nextStatus: "cooked" | "served" }
  | { type: "bulk_cooked"; orderIds: string[] };

export function KitchenBoard({ eventId, eventName }: KitchenBoardProps) {
  const {
    orders,
    loading: ordersLoading,
    error,
    realtimeState,
    realtimeMessage,
    refetch,
  } = useOrdersRealtime({
    eventId,
  });

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
    byTableAndSeat: guestByTableSeat,
    loading: notesLoading,
    error: notesError,
  } = useSeatGuestNotesForEvent(eventId);

  const [tables, setTables] = useState<KitchenFloorTableRow[]>([]);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [tablesLoading, setTablesLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const tabRefs = useRef<Record<StatusFilter, HTMLButtonElement | null>>({
    all: null,
    pending: null,
    cooked: null,
  });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [soundMuted, setSoundMuted] = useState(false);
  const [listHoveredTableId, setListHoveredTableId] = useState<string | null>(null);
  const [mapFilterTableId, setMapFilterTableId] = useState<string | null>(null);
  const ticketSearchRef = useRef<HTMLInputElement>(null);
  const ticketScrollRef = useRef<HTMLDivElement>(null);
  const [ticketSearch, setTicketSearch] = useState("");
  const [sortByOldestPending, setSortByOldestPending] = useState(true);

  const { readyFlashOrderIds, flashReadyIds } = useReadyFlash();

  const toggleMuteShortcut = useCallback(() => {
    primeKitchenAudio();
    setSoundMuted((prev) => {
      const next = !prev;
      setKitchenSoundMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setSoundMuted(isKitchenSoundMuted());
  }, []);

  const pendingOnly = useMemo(
    () => displayOrders.filter((o) => o.status === "pending"),
    [displayOrders],
  );
  const { toast, dismissToast } = useKitchenNewOrderPing(pendingOnly);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setTablesLoading(true);
    setTablesError(null);

    void (async () => {
      const { data, error: qErr } = await supabase
        .from("banquet_tables")
        .select("id, name, total_seats, layout, layout_config, floor_x, floor_y, floor_rotation")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });

      if (cancelled) return;
      if (qErr) {
        setTablesError(qErr.message);
        setTables([]);
      } else {
        setTables((data ?? []) as KitchenFloorTableRow[]);
      }
      setTablesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return displayOrders;
    return displayOrders.filter((o) => o.status === statusFilter);
  }, [displayOrders, statusFilter]);

  /** Live count per filter — shown inside each tab so staff know what's hidden. */
  const statusCounts = useMemo<Record<StatusFilter, number>>(() => {
    let pending = 0;
    let cooked = 0;
    for (const o of displayOrders) {
      if (o.status === "pending") pending += 1;
      else if (o.status === "cooked") cooked += 1;
    }
    return { all: pending + cooked, pending, cooked };
  }, [displayOrders]);

  /** Keyboard shortcuts: 1–3 filters · m mute · / search. Respects text fields. */
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key === "1") {
        event.preventDefault();
        setStatusFilter("all");
      } else if (event.key === "2") {
        event.preventDefault();
        setStatusFilter("pending");
      } else if (event.key === "3") {
        event.preventDefault();
        setStatusFilter("cooked");
      } else if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        toggleMuteShortcut();
      } else if (event.key === "/") {
        event.preventDefault();
        ticketSearchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleMuteShortcut]);

  /** Arrow-key navigation inside the tablist (roving tabindex). */
  const onTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, current: StatusFilter) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
        return;
      }
      event.preventDefault();
      const currentIdx = STATUS_FILTER_KEYS.indexOf(current);
      let nextIdx = currentIdx;
      if (event.key === "ArrowLeft") nextIdx = (currentIdx - 1 + STATUS_FILTER_KEYS.length) % STATUS_FILTER_KEYS.length;
      else if (event.key === "ArrowRight") nextIdx = (currentIdx + 1) % STATUS_FILTER_KEYS.length;
      else if (event.key === "Home") nextIdx = 0;
      else if (event.key === "End") nextIdx = STATUS_FILTER_KEYS.length - 1;
      const nextKey = STATUS_FILTER_KEYS[nextIdx];
      if (!nextKey) return;
      setStatusFilter(nextKey);
      tabRefs.current[nextKey]?.focus();
    },
    [],
  );

  const mapFilteredOrders = useMemo(() => {
    if (!mapFilterTableId) return filteredOrders;
    return filteredOrders.filter((o) => o.table_id === mapFilterTableId);
  }, [filteredOrders, mapFilterTableId]);

  const mapFilterTableName = useMemo(() => {
    if (!mapFilterTableId) return null;
    const fromOrder = displayOrders.find((o) => o.table_id === mapFilterTableId)?.banquet_tables?.name;
    const fromFloor = tables.find((t) => t.id === mapFilterTableId)?.name;
    return fromOrder ?? fromFloor ?? "Table";
  }, [mapFilterTableId, displayOrders, tables]);

  const onTableMapToggleFilter = useCallback((tableId: string) => {
    setMapFilterTableId((prev) => (prev === tableId ? null : tableId));
  }, []);

  /** Table buckets before search/sort (inner row order unchanged). */
  const groupedBuckets = useMemo(() => {
    const map = groupOrdersByTable(mapFilteredOrders, menuCourseSortIndex);
    return [...map.values()];
  }, [mapFilteredOrders]);

  /** Search + prioritise oldest pending first (kitchen board default). */
  const ticketListBuckets = useMemo(() => {
    let list = [...groupedBuckets];
    const q = ticketSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => t.tableName.toLowerCase().includes(q));
    }
    if (sortByOldestPending) {
      list.sort((a, b) => {
        const da = oldestPendingTime(a.rows);
        const db = oldestPendingTime(b.rows);
        if (da === null && db === null) return a.tableName.localeCompare(b.tableName);
        if (da === null) return 1;
        if (db === null) return -1;
        const diff = da.getTime() - db.getTime();
        return diff !== 0 ? diff : a.tableName.localeCompare(b.tableName);
      });
    } else {
      list.sort((a, b) => a.tableName.localeCompare(b.tableName));
    }
    return list;
  }, [groupedBuckets, ticketSearch, sortByOldestPending]);

  /** Ready-for-pickup tray — cooked lines in current list filter. */
  const pickupTrayTables = useMemo(() => cookedOrdersByTable(mapFilteredOrders), [mapFilteredOrders]);

  const useVirtualLayout = ticketListBuckets.length >= VF_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: ticketListBuckets.length,
    getScrollElement: () => ticketScrollRef.current,
    estimateSize: () => 420,
    measureElement:
      typeof window !== "undefined"
        ? (el) => (el instanceof HTMLElement ? el.getBoundingClientRect().height : 420)
        : undefined,
    overscan: 6,
  });

  const openOrderCountByTableId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of displayOrders) {
      if (o.status !== "pending" && o.status !== "cooked") continue;
      const tid = o.table_id;
      m[tid] = (m[tid] ?? 0) + 1;
    }
    return m;
  }, [displayOrders]);

  const guestLookup = useCallback(
    (tableId: string, seat: number) => guestByTableSeat.get(`${tableId}:${seat}`),
    [guestByTableSeat],
  );

  const mealTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of mapFilteredOrders) {
      const label = o.menu_items?.label ?? "—";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [mapFilteredOrders]);

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

  const loading = ordersLoading || notesLoading || tablesLoading;
  const loadError = error ?? notesError ?? tablesError;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col pb-[max(7rem,env(safe-area-inset-bottom,0px)+5.5rem)] md:pb-[max(8rem,env(safe-area-inset-bottom,0px)+6rem)]"
      onPointerDown={() => {
        primeKitchenAudio();
      }}
    >
      {toast ? (
        <div className="fixed left-1/2 top-20 z-[100] w-[min(100%,24rem)] -translate-x-1/2 px-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-600/60 bg-amber-950 px-4 py-3 text-amber-50 shadow-lg">
            <p className="text-sm font-semibold">{toast}</p>
            <button
              type="button"
              className="shrink-0 text-sm underline"
              onClick={() => dismissToast()}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <div className="shrink-0 p-4 sm:p-6 sm:pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{eventName}</h1>
            <p className="mt-1 text-lg text-neutral-400">
              Live board · tap a table on the map to filter tickets · hover a ticket to highlight the table
            </p>
          </div>
          <button
            type="button"
            className="focus-visible-kitchen min-h-[44px] rounded-lg border border-neutral-600 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
            onClick={toggleMuteShortcut}
          >
            {soundMuted ? "Unmute new-order sound" : "Mute new-order sound"}
          </button>
        </div>
        <div className="mt-3">
          <RealtimeConnectionBanner
            variant="kitchen"
            realtimeState={realtimeState}
            realtimeMessage={realtimeMessage}
            onRefresh={() => void refetch({ silent: true })}
          />
        </div>
        <div
          role="tablist"
          aria-label="Filter orders by status"
          className="mt-4 flex flex-wrap gap-2"
        >
          {STATUS_FILTER_KEYS.map((key, idx) => {
            const active = statusFilter === key;
            const count = statusCounts[key];
            return (
              <button
                key={key}
                ref={(el) => {
                  tabRefs.current[key] = el;
                }}
                role="tab"
                aria-selected={active}
                aria-controls="kitchen-tickets-panel"
                id={`kitchen-filter-tab-${key}`}
                tabIndex={active ? 0 : -1}
                type="button"
                onClick={() => setStatusFilter(key)}
                onKeyDown={(event) => onTabKeyDown(event, key)}
                title={`${STATUS_FILTER_LABELS[key]} — press ${idx + 1}`}
                className={`group relative flex min-h-[52px] items-center gap-3 rounded-xl px-4 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-kitchen ${
                  active
                    ? "bg-accent text-accent-foreground shadow-[0_2px_16px_rgba(232,121,35,0.35)]"
                    : "border border-border-kitchen bg-surface-kitchen-elevated text-zinc-200 hover:bg-surface-kitchen-elevated/80"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[11px] font-bold ${
                    active
                      ? "bg-black/25 text-accent-foreground"
                      : "bg-black/30 text-neutral-400 group-hover:text-neutral-200"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-base font-bold">{STATUS_FILTER_LABELS[key]}</span>
                  <span
                    className={`text-[11px] font-medium uppercase tracking-wide ${
                      active ? "text-accent-foreground/80" : "text-neutral-500"
                    }`}
                  >
                    {STATUS_FILTER_HINTS[key]}
                  </span>
                </span>
                <span
                  aria-label={`${count} ${count === 1 ? "order" : "orders"}`}
                  className={`ml-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums ${
                    active
                      ? "bg-black/30 text-accent-foreground"
                      : count > 0
                        ? "bg-amber-500/15 text-amber-200"
                        : "bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
          <p className="sr-only">
            Tip: press 1, 2, or 3 for filters, M to mute, slash to search tables. Arrow keys move between filter tabs.
          </p>
        </div>
        {loadError ? (
          <p className="mt-4 rounded-lg bg-red-950 px-4 py-3 text-lg text-red-200">{loadError}</p>
        ) : null}
        {loading ? (
          <p className="mt-4 text-xl text-neutral-500">Loading board…</p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border-kitchen md:flex-row md:pb-0">
        {/* md: ~65/35 — xl: 60/40 for more ticket width on large kitchen screens */}
        <div className="flex min-h-[36vh] w-full min-w-0 shrink-0 flex-col border-border-kitchen md:min-h-0 md:h-full md:w-[65%] md:max-w-[65%] md:shrink-0 md:border-r md:border-border-kitchen xl:w-[60%] xl:max-w-[60%]">
          <div className="shrink-0 border-b border-border-kitchen px-4 py-2 sm:px-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Room & seats
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
            {!loading && tables.length === 0 ? (
              <p className="text-neutral-500">No tables configured for this event.</p>
            ) : null}
            {!loading && tables.length > 0 ? (
              <KitchenEventFloor
                eventId={eventId}
                tables={tables}
                openOrderCountByTableId={openOrderCountByTableId}
                highlightedTableId={listHoveredTableId}
                selectedTableFilterId={mapFilterTableId}
                onTableMapToggleFilter={onTableMapToggleFilter}
              />
            ) : null}
          </div>
        </div>

        <div
          id="kitchen-tickets-panel"
          role="tabpanel"
          aria-labelledby={`kitchen-filter-tab-${statusFilter}`}
          className="flex min-h-[32vh] w-full min-w-0 flex-col md:min-h-0 md:h-full md:w-[35%] md:max-w-[35%] md:shrink-0 xl:w-[40%] xl:max-w-[40%]"
        >
          <div className="shrink-0 space-y-3 border-b border-border-kitchen px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                Tickets by table
              </h2>
              <button
                type="button"
                onClick={() => setSortByOldestPending((prev) => !prev)}
                aria-pressed={sortByOldestPending}
                title="Toggle sort order"
                className="focus-visible-kitchen min-h-[44px] rounded-lg border border-border-kitchen px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-surface-kitchen-elevated"
              >
                {sortByOldestPending ? (
                  <>
                    Sort: <span className="text-neutral-100">Late first</span>
                  </>
                ) : (
                  <>
                    Sort: <span className="text-neutral-100">A–Z</span>
                  </>
                )}
              </button>
            </div>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Find table
              <input
                ref={ticketSearchRef}
                type="search"
                value={ticketSearch}
                autoComplete="off"
                spellCheck={false}
                placeholder="Search by table name…"
                onChange={(e) => setTicketSearch(e.target.value)}
                className="focus-visible-kitchen mt-1.5 w-full rounded-lg border border-border-kitchen bg-neutral-950/60 px-3 py-2 text-sm font-medium text-white placeholder:text-neutral-600"
              />
            </label>
          </div>
          <div
            ref={useVirtualLayout ? ticketScrollRef : undefined}
            className="relative min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"
          >
            {pickupTrayTables.length > 0 ? (
              <section
                className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-3 py-2.5"
                aria-label="Tables with dishes ready for pickup"
              >
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  <span aria-hidden="true">✓</span>
                  Ready for pickup · tap table
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pickupTrayTables.map((entry) => (
                    <button
                      key={`pickup-${entry.tableId}`}
                      type="button"
                      title={`Focus ${entry.tableName} in ticket list`}
                      aria-label={`${entry.tableName}, ${entry.count} ready for pickup — filter ticket list`}
                      onClick={() => setMapFilterTableId(entry.tableId)}
                      className="focus-visible-kitchen inline-flex items-center gap-1.5 rounded-md border border-emerald-700/55 bg-neutral-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-950/50"
                    >
                      <span>{entry.tableName}</span>
                      <span className="tabular-nums text-emerald-200/90">×{entry.count}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            {mapFilterTableId ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-600/40 bg-amber-950/35 px-3 py-2">
                <p className="text-sm font-medium text-amber-50">
                  Showing <span className="font-bold">{mapFilterTableName}</span> only
                </p>
                <button
                  type="button"
                  className="focus-visible-kitchen min-h-[40px] shrink-0 rounded-md border border-amber-500/60 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/40"
                  onClick={() => setMapFilterTableId(null)}
                >
                  Show all tables
                </button>
              </div>
            ) : null}
            {ticketListBuckets.length === 0 && !loading ? (
              <p className="text-lg text-neutral-500">
                {displayOrders.length === 0
                  ? "No open orders for this event."
                  : "No orders in this filter."}
              </p>
            ) : null}
            {ticketListBuckets.length > 0 && useVirtualLayout ? (
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  position: "relative",
                  width: "100%",
                  contain: "strict",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const bucket = ticketListBuckets[virtualRow.index];
                  if (!bucket) return null;
                  const { tableId, tableName, rows } = bucket;
                  return (
                    <div
                      key={tableId}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 box-border w-full pb-4"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <KitchenTableTicket
                        eventId={eventId}
                        tableId={tableId}
                        tableName={tableName}
                        rows={rows}
                        guestFingerprint={guestFingerprintForTableRows(tableId, rows, guestLookup)}
                        guestNotice={(seat) => guestLookup(tableId, seat) ?? null}
                        advance={advance}
                        advanceCoursePending={advanceCoursePending}
                        pendingId={pendingId}
                        isPending={isPending}
                        readyFlashOrderIds={readyFlashOrderIds}
                        onTableHoverStart={() => setListHoveredTableId(tableId)}
                        onTableHoverEnd={() => setListHoveredTableId(null)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
            {ticketListBuckets.length > 0 && !useVirtualLayout ? (
              <ul className="space-y-4 xl:grid xl:grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] xl:gap-4 xl:space-y-0">
                {ticketListBuckets.map(({ tableId, tableName, rows }) => (
                  <li key={tableId}>
                    <KitchenTableTicket
                      eventId={eventId}
                      tableId={tableId}
                      tableName={tableName}
                      rows={rows}
                      guestFingerprint={guestFingerprintForTableRows(tableId, rows, guestLookup)}
                      guestNotice={(seat) => guestLookup(tableId, seat) ?? null}
                      advance={advance}
                      advanceCoursePending={advanceCoursePending}
                      pendingId={pendingId}
                      isPending={isPending}
                      readyFlashOrderIds={readyFlashOrderIds}
                      onTableHoverStart={() => setListHoveredTableId(tableId)}
                      onTableHoverEnd={() => setListHoveredTableId(null)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-kitchen bg-surface-kitchen/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-12px_32px_rgba(0,0,0,0.55)] backdrop-blur-md supports-[backdrop-filter]:bg-surface-kitchen/90 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500/90">
          Totals (current filter)
        </p>
        {mealTotals.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-400">
            No meals in this filter — place orders from the waiter view to see counts here.
          </p>
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
  );
}
