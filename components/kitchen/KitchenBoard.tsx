"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useKitchenNewOrderPing } from "@/hooks/useKitchenNewOrderPing";
import { useOrdersRealtime, type OrderWithRelations } from "@/hooks/useOrdersRealtime";
import { useSeatGuestNotesForEvent } from "@/hooks/useSeatGuestNotesRealtime";
import { menuCourseSortIndex, menuCourseTitle } from "@/lib/domain/menu-course";
import {
  isKitchenSoundMuted,
  setKitchenSoundMuted,
} from "@/lib/kitchen/play-beep";
import { advanceOrderStatus } from "@/lib/actions/kitchen";
import { RealtimeConnectionBanner } from "@/components/staff/RealtimeConnectionBanner";
import { createClient } from "@/lib/supabase/client";
import {
  KitchenEventFloor,
  type KitchenFloorTableRow,
} from "@/components/kitchen/KitchenEventFloor";

type KitchenBoardProps = {
  eventId: string;
  eventName: string;
};

type StatusFilter = "all" | "pending" | "cooked";

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
  const {
    byTableAndSeat: guestByTableSeat,
    loading: notesLoading,
    error: notesError,
  } = useSeatGuestNotesForEvent(eventId);

  const [tables, setTables] = useState<KitchenFloorTableRow[]>([]);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [tablesLoading, setTablesLoading] = useState(true);

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
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { tableName: string; rows: OrderWithRelations[] }>();
    for (const o of filteredOrders) {
      const key = o.table_id;
      const name = o.banquet_tables?.name ?? "Table";
      const bucket = map.get(key) ?? { tableName: name, rows: [] as OrderWithRelations[] };
      bucket.tableName = name;
      bucket.rows.push(o);
      map.set(key, bucket);
    }
    for (const v of map.values()) {
      v.rows.sort(
        (a, b) =>
          a.seat_number - b.seat_number ||
          menuCourseSortIndex(a.course) - menuCourseSortIndex(b.course) ||
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].tableName.localeCompare(b[1].tableName),
    );
  }, [filteredOrders]);

  /** Floor badges: pending + cooked, independent of list filter (matches waiter "open"). */
  const openOrderCountByTableId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of orders) {
      if (o.status !== "pending" && o.status !== "cooked") continue;
      const tid = o.table_id;
      m[tid] = (m[tid] ?? 0) + 1;
    }
    return m;
  }, [orders]);

  const guestLookup = useCallback(
    (tableId: string, seat: number) => guestByTableSeat.get(`${tableId}:${seat}`),
    [guestByTableSeat],
  );

  const flatLines = useMemo(() => {
    const lines: {
      key: string;
      tableName: string;
      seat: number;
      dish: string;
      guestNotice: string | null;
      courseWish: string | null;
      status: string;
      order: OrderWithRelations;
    }[] = [];
    for (const [, { tableName, rows }] of grouped) {
      for (const o of rows) {
        const gn = guestLookup(o.table_id, o.seat_number);
        const guestNotice = gn?.trim() ? gn.trim() : null;
        lines.push({
          key: o.id,
          tableName,
          seat: o.seat_number,
          dish: o.menu_items?.label ?? "—",
          guestNotice,
          courseWish: o.special_wishes?.trim() ? o.special_wishes.trim() : null,
          status: o.status,
          order: o,
        });
      }
    }
    return lines.sort(
      (a, b) =>
        a.tableName.localeCompare(b.tableName) ||
        a.seat - b.seat ||
        menuCourseSortIndex(a.order.course) - menuCourseSortIndex(b.order.course) ||
        a.dish.localeCompare(b.dish),
    );
  }, [grouped, guestLookup]);

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

  const loading = ordersLoading || notesLoading || tablesLoading;
  const loadError = error ?? notesError ?? tablesError;

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-28 md:pb-32">
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
            <p className="mt-1 text-lg text-neutral-400">Live board · floor + list · tap status when ready</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-neutral-600 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
            onClick={() => {
              const next = !soundMuted;
              setSoundMuted(next);
              setKitchenSoundMuted(next);
            }}
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
        <div className="mt-4 flex flex-wrap gap-2">
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
        {loadError ? (
          <p className="mt-4 rounded-lg bg-red-950 px-4 py-3 text-lg text-red-200">{loadError}</p>
        ) : null}
        {rpcError ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-950 px-4 py-3 text-lg text-red-200"
          >
            {rpcError}
          </p>
        ) : null}
        {loading ? (
          <p className="mt-4 text-xl text-neutral-500">Loading board…</p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-neutral-800 md:flex-row md:pb-0">
        {/* ≥768px: 70 / 30 split (was lg-only before, so many laptop widths stacked vertically) */}
        <div className="flex min-h-[36vh] w-full min-w-0 shrink-0 flex-col border-neutral-800 md:min-h-0 md:h-full md:w-[70%] md:max-w-[70%] md:shrink-0 md:border-r md:border-neutral-800">
          <div className="shrink-0 border-b border-neutral-800 px-4 py-2 sm:px-6">
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
              />
            ) : null}
          </div>
        </div>

        <div className="flex min-h-[32vh] w-full min-w-0 flex-col md:min-h-0 md:h-full md:w-[30%] md:max-w-[30%] md:shrink-0">
          <div className="shrink-0 border-b border-neutral-800 px-4 py-2 sm:px-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              By table & seat
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {flatLines.length === 0 && !loading ? (
              <p className="text-lg text-neutral-500">
                {orders.length === 0 ? "No open orders for this event." : "No orders in this filter."}
              </p>
            ) : null}
            <ul className="space-y-3">
              {flatLines.map((line) => (
                <li
                  key={line.key}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-3"
                >
                  <p className="text-sm font-semibold text-white">
                    {line.tableName} · Seat {line.seat}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    {menuCourseTitle(line.order.course)}
                  </p>
                  <p className="text-lg font-medium text-amber-100">{line.dish}</p>
                  {line.guestNotice ? (
                    <div className="mt-2 rounded-md border border-red-900/50 bg-red-950/40 px-2 py-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-red-400">
                        Guest · allergies · all courses
                      </p>
                      <p className="mt-0.5 text-sm font-semibold leading-snug text-red-200">
                        {line.guestNotice}
                      </p>
                    </div>
                  ) : null}
                  {line.courseWish ? (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        This plate only
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-neutral-400">{line.courseWish}</p>
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs uppercase tracking-wider text-neutral-500">
                    {line.status}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {line.order.status === "pending" ? (
                      <button
                        type="button"
                        disabled={isPending && pendingId === line.order.id}
                        onClick={() => advance(line.order.id, "cooked")}
                        className="min-h-[44px] flex-1 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
                      >
                        Cooked
                      </button>
                    ) : null}
                    {line.order.status === "cooked" ? (
                      <button
                        type="button"
                        disabled={isPending && pendingId === line.order.id}
                        onClick={() => advance(line.order.id, "served")}
                        className="min-h-[44px] flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
                      >
                        Served
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950 px-4 py-3 shadow-[0_-12px_32px_rgba(0,0,0,0.55)] sm:px-6">
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
              <span key={label}>
                {count}× {label}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
