"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Json, TableLayout } from "@/lib/database.types";
import { FloorPlanTableShape } from "@/components/floor-plan/FloorPlanTableShape";
import {
  kitchenWaiterShapeHalfExtents,
  separateFloorBoxes,
} from "@/lib/domain/separate-floor-points";

export type KitchenFloorTableRow = {
  id: string;
  name: string;
  total_seats: number;
  layout: TableLayout;
  layout_config: unknown;
  floor_x: number | null;
  floor_y: number | null;
  floor_rotation: number;
};

type KitchenEventFloorProps = {
  eventId: string;
  tables: KitchenFloorTableRow[];
  /** Pending + cooked counts per table (same idea as waiter "open"). From full order list, not the status filter. */
  openOrderCountByTableId: Record<string, number>;
  /** List-side hover highlights this table on the map */
  highlightedTableId?: string | null;
  /** Map selection filters the ticket list to this table (same id again clears) */
  selectedTableFilterId?: string | null;
  onTableMapToggleFilter?: (tableId: string) => void;
};

function layoutLabel(layout: TableLayout): string {
  if (layout === "round") return "Round";
  if (layout === "block") return "Block";
  return "L";
}

function TableSilhouette({
  table,
  openCount,
  tableHref,
  isHighlighted,
  isFilterSelected,
  onMapPress,
}: {
  table: KitchenFloorTableRow;
  openCount: number;
  tableHref: string;
  isHighlighted: boolean;
  isFilterSelected: boolean;
  onMapPress: () => void;
}) {
  const label =
    openCount > 0
      ? `${table.name}, ${openCount} open kitchen tickets. Tap table to filter ticket list. Seat map opens from link below.`
      : `${table.name}, no open kitchen tickets. Tap to filter list. Seat map from link below.`;

  const inner = (
    <FloorPlanTableShape
      layout={table.layout}
      totalSeats={table.total_seats}
      layoutConfig={table.layout_config as Json | null}
      floorVariant="waiter"
    >
      <span className="max-w-full truncate text-[11px] font-semibold">{table.name}</span>
      {openCount > 0 ? (
        <span className="mt-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-neutral-950">
          {openCount} open
        </span>
      ) : null}
    </FloorPlanTableShape>
  );

  const ringClass = isHighlighted
    ? "shadow-[0_0_22px_rgba(34,211,238,0.55)] ring-2 ring-cyan-400"
    : isFilterSelected
      ? "shadow-[0_0_18px_rgba(251,191,36,0.45)] ring-2 ring-amber-400"
      : "ring-0";

  return (
    <div className="flex w-max max-w-[8rem] flex-col items-center gap-1">
      <button
        type="button"
        aria-label={label}
        aria-pressed={isFilterSelected}
        onClick={onMapPress}
        className={`block w-max max-w-[8rem] rounded-md outline-none ring-offset-2 ring-offset-neutral-950 transition-shadow duration-200 will-change-transform hover:z-[100] hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] ${ringClass}`}
      >
        {inner}
      </button>
      <Link
        href={tableHref}
        className="text-center text-[10px] font-semibold text-cyan-400/90 underline-offset-2 hover:text-cyan-300 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        Seat map
      </Link>
    </div>
  );
}

export function KitchenEventFloor({
  eventId,
  tables,
  openOrderCountByTableId,
  highlightedTableId = null,
  selectedTableFilterId = null,
  onTableMapToggleFilter,
}: KitchenEventFloorProps) {
  const canFloor = tables.some(
    (t) =>
      t.floor_x != null &&
      t.floor_y != null &&
      Number.isFinite(t.floor_x) &&
      Number.isFinite(t.floor_y),
  );

  const displayPositions = useMemo(() => {
    const placed = tables.filter(
      (t) =>
        t.floor_x != null &&
        t.floor_y != null &&
        Number.isFinite(t.floor_x) &&
        Number.isFinite(t.floor_y),
    );
    const boxes = placed.map((t) => {
      const { halfW, halfH } = kitchenWaiterShapeHalfExtents(t.layout);
      return {
        id: t.id,
        x: t.floor_x as number,
        y: t.floor_y as number,
        halfW,
        halfH,
      };
    });
    return separateFloorBoxes(boxes, { margin: 0.06, iterations: 55, gap: 0.012 });
  }, [tables]);

  if (canFloor) {
    return (
      <div
        className="relative mx-auto w-full overflow-auto rounded-xl border border-dashed border-neutral-700 bg-neutral-950/40 p-2 sm:p-3"
        aria-label="Room floor and tables"
      >
        <p className="mb-2 text-center text-xs text-neutral-500">
          Tap a table to filter the ticket list on the right. Use <span className="font-semibold text-neutral-400">Seat map</span> for the same layout as the waiter view (view only).
        </p>
        <div className="mx-auto max-h-[min(72dvh,36rem)] w-full max-w-lg overflow-x-auto overflow-y-auto overscroll-contain rounded-lg border border-dashed border-neutral-600 bg-neutral-900/80 [-webkit-overflow-scrolling:touch]">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-lg">
            <div className="absolute inset-5 sm:inset-6">
              {tables.map((t, floorIndex) => {
                const fx = t.floor_x;
                const fy = t.floor_y;
                if (fx == null || fy == null || !Number.isFinite(fx) || !Number.isFinite(fy)) {
                  return null;
                }
                const adjusted = displayPositions.get(t.id);
                const px = adjusted?.x ?? fx;
                const py = adjusted?.y ?? fy;
                const rot = Number.isFinite(t.floor_rotation) ? t.floor_rotation : 0;
                const openCount = openOrderCountByTableId[t.id] ?? 0;
                return (
                  <div
                    key={t.id}
                    className="absolute"
                    style={{
                      left: `${px * 100}%`,
                      top: `${py * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${rot}deg)`,
                      zIndex: 10 + floorIndex,
                    }}
                  >
                    <TableSilhouette
                      table={t}
                      openCount={openCount}
                      tableHref={`/kitchen/${eventId}/t/${t.id}`}
                      isHighlighted={highlightedTableId === t.id}
                      isFilterSelected={selectedTableFilterId === t.id}
                      onMapPress={() => onTableMapToggleFilter?.(t.id)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tables.map((t) => {
        const openCount = openOrderCountByTableId[t.id] ?? 0;
        return (
          <div key={t.id} className="flex flex-col items-center">
            <TableSilhouette
              table={t}
              openCount={openCount}
              tableHref={`/kitchen/${eventId}/t/${t.id}`}
              isHighlighted={highlightedTableId === t.id}
              isFilterSelected={selectedTableFilterId === t.id}
              onMapPress={() => onTableMapToggleFilter?.(t.id)}
            />
            <p className="mt-2 text-center text-[10px] text-neutral-500">
              {t.total_seats} seats · {layoutLabel(t.layout)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
