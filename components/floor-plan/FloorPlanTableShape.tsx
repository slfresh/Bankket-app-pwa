"use client";

import type { ReactNode } from "react";
import type { Json, TableLayout } from "@/lib/database.types";
import { lShapeLegCounts, parseLShapeLayoutConfig } from "@/lib/domain/seat-layout";

export type FloorPlanVariant = "default" | "waiter";

type FloorPlanTableShapeProps = {
  layout: TableLayout;
  totalSeats: number;
  layoutConfig?: Json | null;
  children: ReactNode;
  /** Waiter floor: compact label + stronger L-table fill */
  floorVariant?: FloorPlanVariant;
};

/**
 * Visual silhouette for a table on a floor plan (manager + waiter), driven by `layout`.
 */
export function FloorPlanTableShape({
  layout,
  totalSeats,
  layoutConfig,
  children,
  floorVariant = "default",
}: FloorPlanTableShapeProps) {
  if (layout === "round") {
    return (
      <div className="flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-full border-2 border-neutral-400 bg-white p-1.5 text-center text-[10px] font-semibold shadow-md dark:border-neutral-500 dark:bg-neutral-950">
        {children}
      </div>
    );
  }

  if (layout === "block") {
    return (
      <div className="flex h-[3.5rem] min-w-[6.5rem] max-w-[7rem] flex-col items-center justify-center rounded-lg border-2 border-neutral-400 bg-white px-1.5 py-1 text-center text-[10px] font-semibold shadow-md dark:border-neutral-500 dark:bg-neutral-950">
        {children}
      </div>
    );
  }

  const legs = lShapeLegCounts(totalSeats, parseLShapeLayoutConfig(layoutConfig));
  const waiter = floorVariant === "waiter";
  return (
    <div className="relative flex h-[5rem] w-[5rem] flex-col items-center justify-center text-center text-[10px] font-semibold shadow-md">
      <LShapeSvg legs={legs} waiter={waiter} />
      <div
        className={
          waiter
            ? "relative z-[1] flex max-h-[85%] max-w-[90%] flex-col items-center justify-center gap-0.5"
            : "relative z-[1] flex max-h-full max-w-full flex-col items-center justify-center gap-0.5 px-0.5 py-0.5"
        }
      >
        {waiter ? (
          <div className="rounded-md bg-white/95 px-1.5 py-1 shadow-sm ring-1 ring-neutral-200/80 dark:bg-neutral-950/95 dark:ring-neutral-600/80">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/**
 * Thick L silhouette: top horizontal arm + vertical stem on the right + bottom horizontal
 * along the foot. Single closed outer loop (no missing edge — the old path looked like an “F”).
 */
function LShapeSvg({ legs, waiter }: { legs: [number, number, number]; waiter: boolean }) {
  const [a, b, c] = legs;
  const sum = Math.max(a + b + c, 1);

  const x0 = 6;
  const y0 = 6;
  const t = waiter ? 12 : 10;
  const topRightX = Math.min(50, x0 + 16 + 28 * (0.45 + 0.55 * (a / sum)));
  const stemW = Math.min(12, Math.max(9, 8 + 4 * (c / sum)));
  const stemLeftX = topRightX - stemW;
  const bottomY = Math.min(50, y0 + t + 14 + 24 * (0.45 + 0.55 * (b / sum)));

  const d = `M ${x0} ${y0} H ${topRightX} V ${y0 + t} H ${stemLeftX} V ${bottomY} H ${x0} Z`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-md"
      viewBox="0 0 56 56"
      aria-hidden
    >
      <path
        d={d}
        className={
          waiter
            ? "fill-neutral-300 stroke-neutral-500 stroke-2 dark:fill-neutral-600 dark:stroke-neutral-300"
            : "fill-neutral-100 stroke-neutral-400 stroke-2 dark:fill-neutral-800 dark:stroke-neutral-400"
        }
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
