import type { OrderWithRelations } from "@/lib/orders/order-with-relations";

export type GroupedTicket = {
  tableId: string;
  tableName: string;
  rows: OrderWithRelations[];
};

/** Earliest pending `created_at` for a table bucket, or null if none pending. */
export function oldestPendingTime(rows: readonly OrderWithRelations[]): Date | null {
  let oldest: Date | null = null;
  for (const o of rows) {
    if (o.status !== "pending") continue;
    const d = new Date(o.created_at);
    if (!oldest || d < oldest) oldest = d;
  }
  return oldest;
}

/** Fingerprint seat guest notices so memoized tickets rerender when notes change without row churn. */
export function guestFingerprintForTableRows(
  tableId: string,
  rows: readonly OrderWithRelations[],
  guestNotice: (tableIdParam: string, seat: number) => string | null | undefined,
): string {
  const seats = [...new Set(rows.map((r) => r.seat_number))].sort((a, b) => a - b);
  return seats.map((s) => guestNotice(tableId, s)?.trim() ?? "").join("\u001f");
}

/** Group orders into table buckets sorted by seat + course inside each bucket (call site applies table order). */
export function groupOrdersByTable(
  orders: readonly OrderWithRelations[],
  menuCourseSortIndex: (c: OrderWithRelations["course"]) => number,
): Map<string, GroupedTicket> {
  const map = new Map<string, GroupedTicket>();
  for (const o of orders) {
    const key = o.table_id;
    const name = o.banquet_tables?.name ?? "Table";
    const bucket = map.get(key) ?? { tableId: key, tableName: name, rows: [] as OrderWithRelations[] };
    bucket.tableName = name;
    bucket.rows.push(o);
    map.set(key, bucket);
  }
  for (const v of map.values()) {
    v.rows.sort(
      (a, b) =>
        a.seat_number - b.seat_number ||
        menuCourseSortIndex(a.course) - menuCourseSortIndex(b.course) ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }
  return map;
}

/** Ready-for-pickup summary per table (cooked orders in current filtered set). */
export function cookedOrdersByTable(
  orders: readonly OrderWithRelations[],
): { tableId: string; tableName: string; count: number }[] {
  const m = new Map<string, { tableName: string; count: number }>();
  for (const o of orders) {
    if (o.status !== "cooked") continue;
    const prev = m.get(o.table_id) ?? {
      tableName: o.banquet_tables?.name ?? "Table",
      count: 0,
    };
    prev.count += 1;
    prev.tableName = o.banquet_tables?.name ?? prev.tableName;
    m.set(o.table_id, prev);
  }
  return [...m.entries()]
    .map(([tableId, { tableName, count }]) => ({ tableId, tableName, count }))
    .sort((a, b) => a.tableName.localeCompare(b.tableName));
}

export function flashingOrderSig(
  rows: readonly OrderWithRelations[],
  flashing: ReadonlySet<string>,
): string {
  const ids = rows.filter((r) => flashing.has(r.id)).map((r) => r.id);
  ids.sort();
  return ids.join("|");
}

export function ordersContentSig(rows: readonly OrderWithRelations[]): string {
  return rows.map((r) => `${r.id}:${r.status}:${r.updated_at}:${r.created_at}`).join("|");
}
