import type { TableLayout } from "@/lib/database.types";

/**
 * Nudge normalized floor coordinates (0–1) apart so kitchen mini-tables
 * do not sit on top of each other when the manager placed them too close.
 * Display-only — does not change stored `floor_x` / `floor_y`.
 */
export type FloorPointInput = { id: string; x: number; y: number };

/** Axis-aligned footprint in normalized canvas space (0–1) for kitchen floor cards. */
export type FloorBoxInput = {
  id: string;
  x: number;
  y: number;
  halfW: number;
  halfH: number;
};

/**
 * Approximate half-width / half-height of a kitchen floor mini-card in normalized coordinates,
 * so separation can account for tall block/L tables, not just point centers.
 */
export function kitchenTableFloorHalfExtents(
  layout: TableLayout,
  totalSeats: number,
): { halfW: number; halfH: number } {
  const n = Math.max(1, totalSeats);
  // ~7rem card on a ~900–1100px canvas → ~0.06–0.08 half-width
  // Slightly narrower than the absolute wrapper; height matches compact floor mini-plans post-declutter.
  const halfW = 0.072;
  if (layout === "round") {
    const halfH = Math.min(0.17, 0.09 + n * 0.0065);
    return { halfW, halfH };
  }
  if (layout === "l_shape") {
    const halfH = Math.min(0.3, 0.09 + n * 0.017);
    return { halfW, halfH };
  }
  const halfH = Math.min(0.26, 0.08 + n * 0.015);
  return { halfW, halfH };
}

/**
 * Half-extents for waiter-style table silhouettes on the kitchen canvas
 * (same shapes as the waiter floor picker, not the old per-seat mini-grid).
 */
export function kitchenWaiterShapeHalfExtents(layout: TableLayout): { halfW: number; halfH: number } {
  if (layout === "round") {
    return { halfW: 0.07, halfH: 0.07 };
  }
  if (layout === "block") {
    return { halfW: 0.11, halfH: 0.056 };
  }
  return { halfW: 0.082, halfH: 0.082 };
}

/**
 * Conservative footprints for {@link separateFloorBoxes} on the **waiter** floor map.
 * Cards are fixed rem sizes; on a ~320px-wide canvas they span a larger fraction of [0,1]
 * than {@link kitchenWaiterShapeHalfExtents}, so the kitchen-sized boxes still overlapped visually.
 */
export function waiterFloorSeparationHalfExtents(
  layout: TableLayout,
  totalSeats: number,
): { halfW: number; halfH: number } {
  const n = Math.max(1, totalSeats);
  if (layout === "round") {
    return { halfW: 0.14, halfH: 0.15 };
  }
  if (layout === "block") {
    return { halfW: 0.19, halfH: 0.13 };
  }
  const half = Math.min(0.18, 0.12 + n * 0.005);
  return { halfW: half, halfH: Math.min(0.21, half + 0.025) };
}

/**
 * Separate overlapping axis-aligned boxes by nudging centers (display-only).
 * Prefer over {@link separateFloorPoints} when cards are much taller than wide.
 */
export function separateFloorBoxes(
  boxes: FloorBoxInput[],
  options?: { margin?: number; iterations?: number; gap?: number },
): Map<string, { x: number; y: number }> {
  const margin = options?.margin ?? 0.06;
  const iterations = options?.iterations ?? 55;
  const gap = options?.gap ?? 0.012;

  if (boxes.length === 0) {
    return new Map();
  }

  const work = boxes.map((b) => ({ ...b }));

  /** Keep the axis-aligned footprint inside [0,1]²; `margin` is inset from the canvas edge to the card bbox. */
  function clamp(p: { x: number; y: number; halfW: number; halfH: number }) {
    const inset = margin;
    const minX = p.halfW + inset;
    const maxX = 1 - p.halfW - inset;
    const minY = p.halfH + inset;
    const maxY = 1 - p.halfH - inset;
    if (minX <= maxX) {
      p.x = Math.min(maxX, Math.max(minX, p.x));
    } else {
      p.x = 0.5;
    }
    if (minY <= maxY) {
      p.y = Math.min(maxY, Math.max(minY, p.y));
    } else {
      p.y = 0.5;
    }
  }

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < work.length; i++) {
      for (let j = i + 1; j < work.length; j++) {
        const a = work[i]!;
        const b = work[j]!;
        const cx = b.x - a.x;
        const cy = b.y - a.y;
        const overlapX = a.halfW + b.halfW + gap - Math.abs(cx);
        const overlapY = a.halfH + b.halfH + gap - Math.abs(cy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        if (Math.abs(cx) < 1e-9 && Math.abs(cy) < 1e-9) {
          const angle = iter * 1.31 + i * 0.37;
          const push = Math.max(overlapX, overlapY) / 2;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        } else if (overlapX <= overlapY) {
          const push = overlapX / 2;
          const sx = cx >= 0 ? 1 : -1;
          a.x -= sx * push;
          b.x += sx * push;
        } else {
          const push = overlapY / 2;
          const sy = cy >= 0 ? 1 : -1;
          a.y -= sy * push;
          b.y += sy * push;
        }
      }
    }
    for (const p of work) {
      clamp(p);
    }
  }

  const map = new Map<string, { x: number; y: number }>();
  for (const p of work) {
    map.set(p.id, { x: p.x, y: p.y });
  }
  return map;
}

export function separateFloorPoints(
  points: FloorPointInput[],
  options?: { minDist?: number; margin?: number; iterations?: number },
): Map<string, { x: number; y: number }> {
  const minDist = options?.minDist ?? 0.14;
  const margin = options?.margin ?? 0.04;
  const iterations = options?.iterations ?? 35;

  if (points.length === 0) {
    return new Map();
  }

  const work = points.map((p) => ({ id: p.id, x: p.x, y: p.y }));

  function clamp(p: { x: number; y: number }) {
    p.x = Math.min(1 - margin, Math.max(margin, p.x));
    p.y = Math.min(1 - margin, Math.max(margin, p.y));
  }

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < work.length; i++) {
      for (let j = i + 1; j < work.length; j++) {
        const a = work[i]!;
        const b = work[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-9) {
          const angle = iter * 1.37 + i * 0.42;
          dx = Math.cos(angle) * 0.02;
          dy = Math.sin(angle) * 0.02;
          dist = Math.hypot(dx, dy);
        }
        if (dist >= minDist) {
          continue;
        }
        const push = (minDist - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }
    for (const p of work) {
      clamp(p);
    }
  }

  const map = new Map<string, { x: number; y: number }>();
  for (const p of work) {
    map.set(p.id, { x: p.x, y: p.y });
  }
  return map;
}
