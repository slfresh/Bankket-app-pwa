import { describe, expect, it } from "vitest";
import {
  buildTableTicket,
  courseStripeClass,
  courseHeadingAccentClass,
} from "@/lib/kitchen/ticket-model";
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
    menu_items: { label: "Tomato Soup" },
    banquet_tables: { name: "Table 1" },
    ...overrides,
  };
}

describe("buildTableTicket", () => {
  it("groups by course in starter → main → dessert order", () => {
    const rows = [
      fakeOrder({ course: "dessert", menu_item_id: "d1", menu_items: { label: "Cake" } }),
      fakeOrder({ course: "starter", menu_item_id: "s1", menu_items: { label: "Soup" } }),
      fakeOrder({ course: "main", menu_item_id: "m1", menu_items: { label: "Fish" } }),
    ];
    const ticket = buildTableTicket(rows);
    expect(ticket.courses.map((c) => c.course)).toEqual(["starter", "main", "dessert"]);
  });

  it("aggregates identical dishes within a course", () => {
    const rows = [
      fakeOrder({ seat_number: 1, course: "starter", menu_item_id: "s1", menu_items: { label: "Soup" } }),
      fakeOrder({ seat_number: 2, course: "starter", menu_item_id: "s1", menu_items: { label: "Soup" } }),
      fakeOrder({ seat_number: 3, course: "starter", menu_item_id: "s1", menu_items: { label: "Soup" } }),
    ];
    const ticket = buildTableTicket(rows);
    expect(ticket.courses).toHaveLength(1);
    expect(ticket.courses[0].lines).toHaveLength(1);
    expect(ticket.courses[0].lines[0].orders).toHaveLength(3);
    expect(ticket.courses[0].lines[0].dishLabel).toBe("Soup");
  });

  it("separates lines with different special wishes", () => {
    const rows = [
      fakeOrder({ seat_number: 1, course: "main", menu_item_id: "m1", special_wishes: null, menu_items: { label: "Fish" } }),
      fakeOrder({ seat_number: 2, course: "main", menu_item_id: "m1", special_wishes: "No lemon", menu_items: { label: "Fish" } }),
    ];
    const ticket = buildTableTicket(rows);
    const mainSection = ticket.courses.find((c) => c.course === "main");
    expect(mainSection?.lines).toHaveLength(2);
  });

  it("returns empty courses array for empty input", () => {
    const ticket = buildTableTicket([]);
    expect(ticket.courses).toHaveLength(0);
    expect(ticket.tableId).toBe("");
  });

  it("preserves table metadata from first row", () => {
    const rows = [
      fakeOrder({ table_id: "t42", course: "starter", banquet_tables: { name: "VIP" } }),
    ];
    const ticket = buildTableTicket(rows);
    expect(ticket.tableId).toBe("t42");
    expect(ticket.tableName).toBe("VIP");
  });
});

describe("courseStripeClass", () => {
  it("returns green for starter", () => {
    expect(courseStripeClass("starter")).toContain("green");
  });
  it("returns blue for main", () => {
    expect(courseStripeClass("main")).toContain("blue");
  });
  it("returns purple for dessert", () => {
    expect(courseStripeClass("dessert")).toContain("purple");
  });
});

describe("courseHeadingAccentClass", () => {
  it("returns distinct colors for each course", () => {
    const colors = new Set([
      courseHeadingAccentClass("starter"),
      courseHeadingAccentClass("main"),
      courseHeadingAccentClass("dessert"),
    ]);
    expect(colors.size).toBe(3);
  });
});
