import { describe, expect, it } from "vitest";
import { defaultFloorGridPosition } from "@/lib/domain/floor-plan";
import {
  kitchenTableFloorHalfExtents,
  kitchenWaiterShapeHalfExtents,
  separateFloorBoxes,
  separateFloorPoints,
  waiterFloorSeparationHalfExtents,
} from "@/lib/domain/separate-floor-points";
import { lShapeLegCounts } from "@/lib/domain/seat-layout";

describe("defaultFloorGridPosition", () => {
  it("matches 4-column grid pattern", () => {
    expect(defaultFloorGridPosition(0)).toEqual({ floor_x: 0.08, floor_y: 0.08 });
    expect(defaultFloorGridPosition(1)).toEqual({ floor_x: 0.32, floor_y: 0.08 });
    expect(defaultFloorGridPosition(4)).toEqual({ floor_x: 0.08, floor_y: 0.3 });
  });
});

describe("separateFloorPoints", () => {
  it("pushes overlapping coordinates apart", () => {
    const map = separateFloorPoints(
      [
        { id: "a", x: 0.5, y: 0.5 },
        { id: "b", x: 0.5, y: 0.5 },
      ],
      { minDist: 0.12, margin: 0.02, iterations: 50 },
    );
    const a = map.get("a");
    const b = map.get("b");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(Math.hypot((a!.x - b!.x) * 100, (a!.y - b!.y) * 100)).toBeGreaterThan(10);
  });
});

describe("separateFloorBoxes", () => {
  it("separates overlapping axis-aligned boxes", () => {
    const map = separateFloorBoxes(
      [
        { id: "a", x: 0.5, y: 0.5, halfW: 0.08, halfH: 0.12 },
        { id: "b", x: 0.5, y: 0.5, halfW: 0.08, halfH: 0.12 },
      ],
      { margin: 0.05, iterations: 80, gap: 0.01 },
    );
    const a = map.get("a");
    const b = map.get("b");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    const overlapX = 0.08 + 0.08 + 0.01 - Math.abs(b!.x - a!.x);
    const overlapY = 0.12 + 0.12 + 0.01 - Math.abs(b!.y - a!.y);
    expect(overlapX <= 0 || overlapY <= 0).toBe(true);
  });
});

describe("kitchenTableFloorHalfExtents", () => {
  it("returns wider footprint for block than round at same seat count", () => {
    const round9 = kitchenTableFloorHalfExtents("round", 9);
    const block9 = kitchenTableFloorHalfExtents("block", 9);
    expect(block9.halfH).toBeGreaterThanOrEqual(round9.halfH);
  });
});

describe("kitchenWaiterShapeHalfExtents", () => {
  it("block silhouette is wider than tall in normalized space", () => {
    const b = kitchenWaiterShapeHalfExtents("block");
    expect(b.halfW).toBeGreaterThan(b.halfH);
  });
});

describe("waiterFloorSeparationHalfExtents", () => {
  it("uses larger footprints than kitchen waiter extents for phone-sized canvases", () => {
    const k = kitchenWaiterShapeHalfExtents("round");
    const w = waiterFloorSeparationHalfExtents("round", 8);
    expect(w.halfW).toBeGreaterThan(k.halfW);
    expect(w.halfH).toBeGreaterThan(k.halfH);
    const wb = waiterFloorSeparationHalfExtents("block", 9);
    expect(wb.halfW).toBeGreaterThan(kitchenWaiterShapeHalfExtents("block").halfW);
  });
});

describe("lShapeLegCounts", () => {
  it("splits totals into three non-negative legs that sum to total", () => {
    for (const n of [1, 2, 5, 10, 30]) {
      const [a, b, c] = lShapeLegCounts(n);
      expect(a + b + c).toBe(n);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses custom l_legs when they sum to total", () => {
    expect(lShapeLegCounts(12, { l_legs: [4, 4, 4] })).toEqual([4, 4, 4]);
    expect(lShapeLegCounts(12, { l_legs: [10, 1, 1] })).toEqual([10, 1, 1]);
  });

  it("ignores invalid custom legs", () => {
    const auto = lShapeLegCounts(12, null);
    expect(lShapeLegCounts(12, { l_legs: [5, 5, 5] })).toEqual(auto);
  });
});
