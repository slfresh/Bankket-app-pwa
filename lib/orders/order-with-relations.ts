import type { MenuCourse, OrderStatus } from "@/lib/database.types";

/** Shape returned by `orders` select with `menu_items(label), banquet_tables(name)`. */
export type OrderWithRelations = {
  id: string;
  event_id: string;
  table_id: string;
  seat_number: number;
  menu_item_id: string;
  course: MenuCourse;
  special_wishes: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  menu_items: { label: string } | null;
  banquet_tables: { name: string } | null;
};

/** Client-only placeholder id prefix; cleared when server/refetch updates `orders`. */
export function optimisticOrderId(): string {
  return `optimistic:${crypto.randomUUID()}`;
}

/** Build a pending row for useOptimistic before the Server Action returns. */
export function buildPlaceholderOrderRow(p: {
  tempId: string;
  eventId: string;
  tableId: string;
  tableName: string;
  seatNumber: number;
  menuItemId: string;
  course: MenuCourse;
  special_wishes: string | null;
  menuLabel: string;
}): OrderWithRelations {
  const now = new Date().toISOString();
  return {
    id: p.tempId,
    event_id: p.eventId,
    table_id: p.tableId,
    seat_number: p.seatNumber,
    menu_item_id: p.menuItemId,
    course: p.course,
    special_wishes: p.special_wishes,
    status: "pending",
    created_at: now,
    updated_at: now,
    menu_items: { label: p.menuLabel },
    banquet_tables: { name: p.tableName },
  };
}

export function normalizeOrderRow(raw: Record<string, unknown>): OrderWithRelations {
  const menu_items = raw.menu_items as { label: string } | null | undefined;
  const banquet_tables = raw.banquet_tables as { name: string } | null | undefined;
  const courseRaw = raw.course as string | undefined;
  const course: MenuCourse =
    courseRaw === "starter" || courseRaw === "dessert" ? courseRaw : "main";
  return {
    id: String(raw.id),
    event_id: String(raw.event_id),
    table_id: String(raw.table_id),
    seat_number: Number(raw.seat_number),
    menu_item_id: String(raw.menu_item_id),
    course,
    special_wishes: (raw.special_wishes as string | null) ?? null,
    status: raw.status as OrderStatus,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    menu_items: menu_items ?? null,
    banquet_tables: banquet_tables ?? null,
  };
}
