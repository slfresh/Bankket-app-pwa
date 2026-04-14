"use client";

import Link from "next/link";
import { useState } from "react";
import { FloorPlanTableShape } from "@/components/floor-plan/FloorPlanTableShape";
import type { Json, TableLayout } from "@/lib/database.types";

type TableRow = {
  id: string;
  name: string;
  total_seats: number;
  layout: TableLayout;
  layout_config?: Json | null;
  floor_x?: number | null;
  floor_y?: number | null;
  floor_rotation?: number;
};

export function WaiterTablePicker({
  eventId,
  tables,
  openOrderCountByTableId = {},
}: {
  eventId: string;
  tables: TableRow[];
  /** Count of orders in pending or cooked, keyed by table id. */
  openOrderCountByTableId?: Record<string, number>;
}) {
  const canFloor = tables.some(
    (t) => t.floor_x != null && t.floor_y != null && Number.isFinite(t.floor_x) && Number.isFinite(t.floor_y),
  );
  const [mode, setMode] = useState<"list" | "floor">("list");

  return (
    <div className="mt-6">
      {canFloor ? (
        <div className="mb-4 flex gap-2 rounded-lg border border-neutral-200 p-1 dark:border-neutral-800">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              mode === "list"
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 dark:text-neutral-400"
            }`}
            onClick={() => setMode("list")}
          >
            List
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              mode === "floor"
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 dark:text-neutral-400"
            }`}
            onClick={() => setMode("floor")}
          >
            Floor
          </button>
        </div>
      ) : null}

      {mode === "floor" && canFloor ? (
        <div>
          <p className="mb-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
            Open a table to see seats, guest notes, and orders. This map is for room layout only.
          </p>
        <div
          className="relative mx-auto aspect-[4/3] w-full max-w-lg overflow-visible rounded-lg border border-dashed border-neutral-300 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900/80"
          aria-label="Table floor plan"
        >
          <div className="absolute inset-5 sm:inset-6">
            {tables.map((t) => {
              const fx = t.floor_x;
              const fy = t.floor_y;
              if (fx == null || fy == null || !Number.isFinite(fx) || !Number.isFinite(fy)) {
                return null;
              }
              const rot = Number.isFinite(t.floor_rotation) ? (t.floor_rotation as number) : 0;
              const openCount = openOrderCountByTableId[t.id] ?? 0;
              return (
                <Link
                  key={t.id}
                  href={`/waiter/${eventId}/t/${t.id}`}
                  className="absolute z-10 w-max max-w-[8rem] active:scale-[0.98]"
                  style={{
                    left: `${fx * 100}%`,
                    top: `${fy * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${rot}deg)`,
                  }}
                >
                  <FloorPlanTableShape
                    layout={t.layout}
                    totalSeats={t.total_seats}
                    layoutConfig={t.layout_config}
                    floorVariant="waiter"
                  >
                    <span className="max-w-full truncate text-[11px] font-semibold">{t.name}</span>
                    {openCount > 0 ? (
                      <span className="mt-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-neutral-950">
                        {openCount} open
                      </span>
                    ) : null}
                  </FloorPlanTableShape>
                </Link>
              );
            })}
          </div>
        </div>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          {tables.map((t) => {
            const openCount = openOrderCountByTableId[t.id] ?? 0;
            return (
              <li key={t.id}>
                <Link
                  href={`/waiter/${eventId}/t/${t.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium active:bg-neutral-50 dark:active:bg-neutral-900/80"
                >
                  <span>{t.name}</span>
                  {openCount > 0 ? (
                    <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-neutral-950">
                      {openCount} open
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
