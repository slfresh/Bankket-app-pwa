"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { FloorPlanTableShape } from "@/components/floor-plan/FloorPlanTableShape";
import { updateTableFloorPlan } from "@/lib/actions/manager";
import type { Json, TableLayout } from "@/lib/database.types";

export type FloorPlanTable = {
  id: string;
  name: string;
  total_seats: number;
  layout: TableLayout;
  floor_x: number | null;
  floor_y: number | null;
  floor_rotation: number;
  layout_config?: Json | null;
};

function layoutShort(layout: TableLayout): string {
  if (layout === "round") return "Rnd";
  if (layout === "block") return "Blk";
  return "L";
}

const NUDGE = 0.02;

export function EventFloorPlan({
  eventId,
  tables,
}: {
  eventId: string;
  tables: FloorPlanTable[];
}) {
  /** Normalized positions (0–1) are relative to this inset area (matches waiter floor view). */
  const floorInnerRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, FloorPlanTable>>(() => {
    const m: Record<string, FloorPlanTable> = {};
    for (const t of tables) {
      m[t.id] = { ...t };
    }
    return m;
  });

  useEffect(() => {
    const m: Record<string, FloorPlanTable> = {};
    for (const t of tables) {
      m[t.id] = { ...t };
    }
    // Reset local floor positions when server props change (e.g. after router.refresh).
    queueMicrotask(() => setLocal(m));
  }, [tables]);

  const dragRef = useRef<{
    tableId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originRot: number;
  } | null>(null);

  const lastDragPosRef = useRef<{ tableId: string; x: number; y: number } | null>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);

  const persist = useCallback(
    (tableId: string, floor_x: number, floor_y: number, floor_rotation: number) => {
      startTransition(async () => {
        setError(null);
        const res = await updateTableFloorPlan(
          eventId,
          tableId,
          floor_x,
          floor_y,
          floor_rotation,
        );
        if ("error" in res && res.error) {
          setError(res.error);
        }
      });
    },
    [eventId],
  );

  const updateTable = useCallback(
    (tableId: string, patch: Partial<FloorPlanTable>) => {
      setLocal((prev) => {
        const cur = prev[tableId];
        if (!cur) return prev;
        const next = { ...cur, ...patch };
        return { ...prev, [tableId]: next };
      });
    },
    [],
  );

  function onPointerDown(tableId: string, e: React.PointerEvent) {
    if (e.button !== 0) return;
    const el = floorInnerRef.current;
    const row = local[tableId];
    if (!el || !row || row.floor_x == null || row.floor_y == null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      tableId,
      startX: e.clientX,
      startY: e.clientY,
      originX: row.floor_x,
      originY: row.floor_y,
      originRot: row.floor_rotation,
    };
    lastDragPosRef.current = {
      tableId,
      x: row.floor_x,
      y: row.floor_y,
    };
    setDraggingTableId(tableId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    const el = floorInnerRef.current;
    if (!d || !el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w < 1 || h < 1) return;
    const dx = (e.clientX - d.startX) / w;
    const dy = (e.clientY - d.startY) / h;
    const floor_x = Math.min(1, Math.max(0, d.originX + dx));
    const floor_y = Math.min(1, Math.max(0, d.originY + dy));
    lastDragPosRef.current = { tableId: d.tableId, x: floor_x, y: floor_y };
    updateTable(d.tableId, { floor_x, floor_y });
  }

  function onPointerUp(tableId: string, e: React.PointerEvent) {
    const d = dragRef.current;
    if (d?.tableId === tableId) {
      dragRef.current = null;
      setDraggingTableId(null);
      const pos = lastDragPosRef.current;
      if (pos?.tableId === tableId) {
        persist(tableId, pos.x, pos.y, d.originRot);
      }
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function nudge(tableId: string, dx: number, dy: number) {
    const row = local[tableId];
    if (!row || row.floor_x == null || row.floor_y == null) return;
    const floor_x = Math.min(1, Math.max(0, row.floor_x + dx));
    const floor_y = Math.min(1, Math.max(0, row.floor_y + dy));
    updateTable(tableId, { floor_x, floor_y });
    persist(tableId, floor_x, floor_y, row.floor_rotation);
  }

  function rotateBy(tableId: string, delta: number) {
    const row = local[tableId];
    if (!row || row.floor_x == null || row.floor_y == null) return;
    let rot = (row.floor_rotation + delta) % 360;
    if (rot < 0) rot += 360;
    updateTable(tableId, { floor_rotation: rot });
    persist(tableId, row.floor_x, row.floor_y, rot);
  }

  if (tables.length === 0) {
    return null;
  }

  const hasAnyPosition = tables.some((t) => t.floor_x != null && t.floor_y != null);

  function printFloorPlan() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <section
      id="event-floor-print-root"
      className="event-floor-print-root rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Floor plan</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Drag tables on the canvas or use nudge and rotate. Focus a row below and use arrow keys to
            nudge; rotation does not change seat numbering. Coordinates match the waiter floor view.
          </p>
        </div>
        {hasAnyPosition ? (
          <button
            type="button"
            onClick={printFloorPlan}
            className="print:hidden shrink-0 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            Print layout
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {!hasAnyPosition ? (
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          Tables have no floor position yet. Run the latest database migration or regenerate tables.
        </p>
      ) : null}

      <div
        className="relative mx-auto mt-4 aspect-[4/3] w-full max-w-2xl touch-none select-none overflow-visible rounded-lg border border-dashed border-neutral-300 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900/80"
        aria-label="Event floor plan canvas"
      >
        <div ref={floorInnerRef} className="absolute inset-5 sm:inset-6">
          {tables.map((t) => {
            const row = local[t.id] ?? t;
            if (row.floor_x == null || row.floor_y == null) {
              return null;
            }
            return (
              <div
                key={t.id}
                tabIndex={0}
                role="group"
                aria-label={`${row.name}, draggable table marker`}
                aria-grabbed={draggingTableId === t.id}
                className="absolute z-10 w-max max-w-[8rem] cursor-grab outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-neutral-500 active:cursor-grabbing"
                style={{
                  left: `${row.floor_x * 100}%`,
                  top: `${row.floor_y * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${row.floor_rotation}deg)`,
                }}
                onPointerDown={(e) => onPointerDown(t.id, e)}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => onPointerUp(t.id, e)}
                onPointerCancel={(e) => onPointerUp(t.id, e)}
              >
                <FloorPlanTableShape
                  layout={row.layout}
                  totalSeats={row.total_seats}
                  layoutConfig={row.layout_config}
                >
                  <Link
                    href={`/waiter/${eventId}/t/${t.id}`}
                    className="block max-w-full truncate text-[11px] text-blue-700 underline dark:text-blue-300"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.name}
                  </Link>
                  <span className="text-neutral-500">
                    {row.total_seats} · {layoutShort(row.layout)}
                  </span>
                </FloorPlanTableShape>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="event-floor-print-hide-controls mt-4 space-y-2 text-sm">
        {tables.map((t) => {
          const row = local[t.id] ?? t;
          return (
            <li
              key={t.id}
              tabIndex={0}
              className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 px-2 py-2 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-700"
              onKeyDown={(e) => {
                if (row.floor_x == null || row.floor_y == null) return;
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  nudge(t.id, -NUDGE, 0);
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  nudge(t.id, NUDGE, 0);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  nudge(t.id, 0, -NUDGE);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  nudge(t.id, 0, NUDGE);
                }
              }}
            >
              <span className="min-w-[6rem] font-medium">{t.name}</span>
              <span className="text-xs text-neutral-500">
                {row.floor_x != null && row.floor_y != null
                  ? `x ${row.floor_x.toFixed(2)} · y ${row.floor_y.toFixed(2)} · ${Math.round(row.floor_rotation)}°`
                  : "No position"}
              </span>
              <div className="ml-auto flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={pending || row.floor_x == null}
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs dark:border-neutral-600"
                  onClick={() => nudge(t.id, -NUDGE, 0)}
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={pending || row.floor_x == null}
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs dark:border-neutral-600"
                  onClick={() => nudge(t.id, NUDGE, 0)}
                >
                  →
                </button>
                <button
                  type="button"
                  disabled={pending || row.floor_y == null}
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs dark:border-neutral-600"
                  onClick={() => nudge(t.id, 0, -NUDGE)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={pending || row.floor_y == null}
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs dark:border-neutral-600"
                  onClick={() => nudge(t.id, 0, NUDGE)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={pending || row.floor_x == null}
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs dark:border-neutral-600"
                  onClick={() => rotateBy(t.id, -90)}
                >
                  ⟲ 90°
                </button>
                <button
                  type="button"
                  disabled={pending || row.floor_x == null}
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs dark:border-neutral-600"
                  onClick={() => rotateBy(t.id, 90)}
                >
                  ⟳ 90°
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
