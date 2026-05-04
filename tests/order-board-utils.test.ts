import { describe, expect, it } from "vitest";
import {
  cookedOrdersByTable,
  flashingOrderSig,
  groupOrdersByTable,
  guestFingerprintForTableRows,
  oldestPendingTime,
  ordersContentSig,
} from "@/lib/kitchen/order-board-utils";
import type { OrderWithRelations } from "@/lib/orders/order-with-relations";

function fakeOrder(
  overrides: Partial<OrderWithRelations> & { course: OrderWithRelations["course"] },
): OrderWithRelations {
  return {
    id: crypto.randomUUID(),
    event_id: "e1",
    table_id: "t1",
    seat_number: 1,
    menu_item_id: "mi1",
    special_wishes: null,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    menu_items: { label: "Dish" },
    banquet_tables: { name: "Table 1" },
    ...overrides,
  };
}

const idx: (c: OrderWithRelations["course"]) => number = (c) =>
  ({ starter: 0, main: 1, dessert: 2 } as const)[c];

describe("oldestPendingTime", () => {
  it("returns null when no pending rows", () => {
    expect(
      oldestPendingTime([fakeOrder({ course: "main", status: "cooked" })]),
    ).toBeNull();
  });

  it("returns earliest pending created_at", () => {
    const d1 = new Date("2026-05-04T12:00:00Z").toISOString();
    const d2 = new Date("2026-05-04T12:05:00Z").toISOString();
    expect(
      oldestPendingTime([
        fakeOrder({ course: "starter", seat_number: 1, created_at: d2, status: "pending" }),
        fakeOrder({ course: "main", seat_number: 2, created_at: d1, status: "pending" }),
      ]),
    ).toEqual(new Date(d1));
  });
});

describe("guestFingerprintForTableRows", () => {
  it("fingerprints seated notices in sorted seat order", () => {
    const rows = [
      fakeOrder({ seat_number: 2, course: "main" }),
      fakeOrder({ seat_number: 1, course: "main" }),
    ];
    const fn = (_tid: string, seat: number) =>
      seat === 1 ? "veg" : seat === 2 ? "nuts" : null;
    expect(guestFingerprintForTableRows("t1", rows, fn)).toBe("veg\u001fnuts");
  });
});

describe("groupOrdersByTable", () => {
  it("buckets table rows and sorts by seat then course", () => {
    const map = groupOrdersByTable(
      [
        fakeOrder({
          table_id: "tb",
          seat_number: 2,
          course: "starter",
          banquet_tables: { name: "B" },
        }),
        fakeOrder({
          table_id: "tb",
          seat_number: 1,
          course: "dessert",
          banquet_tables: { name: "B" },
        }),
        fakeOrder({
          table_id: "tb",
          seat_number: 1,
          course: "starter",
          banquet_tables: { name: "B" },
        }),
      ],
      idx,
    );
    const bucket = map.get("tb");
    expect(bucket?.rows.map((r) => `${r.seat_number}:${r.course}`)).toEqual([
      "1:starter",
      "1:dessert",
      "2:starter",
    ]);
  });
});

describe("cookedOrdersByTable", () => {
  it("sums cooked orders per table", () => {
    const summary = cookedOrdersByTable([
      fakeOrder({
        table_id: "a",
        course: "main",
        status: "cooked",
        banquet_tables: { name: "Alpha" },
      }),
      fakeOrder({
        table_id: "a",
        course: "main",
        status: "cooked",
        banquet_tables: { name: "Alpha" },
      }),
      fakeOrder({ table_id: "b", course: "main", status: "pending", banquet_tables: { name: "Beta" } }),
    ]);
    expect(summary).toContainEqual({
      tableId: "a",
      tableName: "Alpha",
      count: 2,
    });
    expect(summary.find((x) => x.tableId === "b")).toBeUndefined();
  });
});

describe("flashingOrderSig", () => {
  it("sorted id list joined by pipe", () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    expect(
      flashingOrderSig([fakeOrder({ id: id2 }), fakeOrder({ id: id1 })], new Set([id1, id2])),
    ).toBe([id1, id2].sort().join("|"));
  });
});

describe("ordersContentSig", () => {
  it("encodes ids status and timestamps in order", () => {
    const r = fakeOrder({
      id: "o1",
      course: "main",
      status: "pending",
      created_at: "a",
      updated_at: "b",
    });
    expect(ordersContentSig([r])).toBe("o1:pending:b:a");
  });
});
