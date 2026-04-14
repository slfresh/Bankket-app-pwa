import { describe, expect, it } from "vitest";
import { placeOrderSchema, placeSeatOrdersBatchSchema } from "@/lib/validation/actions";

const EVENT = "11111111-1111-4111-8111-111111111111";
const TABLE = "22222222-2222-4222-8222-222222222222";
const MENU = "33333333-3333-4333-8333-333333333333";

describe("placeOrderSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = placeOrderSchema.safeParse({
      eventId: EVENT,
      tableId: TABLE,
      seatNumber: 3,
      menuItemId: MENU,
      course: "main",
      specialWishes: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid course", () => {
    const parsed = placeOrderSchema.safeParse({
      eventId: EVENT,
      tableId: TABLE,
      seatNumber: 1,
      menuItemId: MENU,
      course: "soup",
      specialWishes: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects seat numbers outside range", () => {
    const parsed = placeOrderSchema.safeParse({
      eventId: EVENT,
      tableId: TABLE,
      seatNumber: 99,
      menuItemId: MENU,
      course: "starter",
      specialWishes: null,
    });
    expect(parsed.success).toBe(false);
  });
});

const MENU_B = "44444444-4444-4444-8444-444444444444";
const MENU_C = "55555555-5555-5555-8555-555555555555";

describe("placeSeatOrdersBatchSchema", () => {
  it("accepts a valid multi-line payload", () => {
    const parsed = placeSeatOrdersBatchSchema.safeParse({
      eventId: EVENT,
      tableId: TABLE,
      seatNumber: 2,
      lines: [
        { course: "starter", menuItemId: MENU, specialWishes: null },
        { course: "main", menuItemId: MENU_B },
        { course: "dessert", menuItemId: MENU_C },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects duplicate courses in lines", () => {
    const parsed = placeSeatOrdersBatchSchema.safeParse({
      eventId: EVENT,
      tableId: TABLE,
      seatNumber: 1,
      lines: [
        { course: "main", menuItemId: MENU },
        { course: "main", menuItemId: MENU_B },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects more than three lines", () => {
    const parsed = placeSeatOrdersBatchSchema.safeParse({
      eventId: EVENT,
      tableId: TABLE,
      seatNumber: 1,
      lines: [
        { course: "starter", menuItemId: MENU },
        { course: "main", menuItemId: MENU_B },
        { course: "dessert", menuItemId: MENU_C },
        { course: "starter", menuItemId: MENU },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
