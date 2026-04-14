import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/database.types";

type AuditRow = {
  id: string;
  action: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus | null;
  seat_number: number | null;
  created_at: string;
};

function actionLabel(row: AuditRow): string {
  if (row.action === "created") return "Order placed";
  if (row.action === "status_changed") {
    return `Status ${row.old_status ?? "?"} → ${row.new_status ?? "?"}`;
  }
  if (row.action === "deleted") return "Order removed";
  return row.action;
}

export async function OrderAuditSection({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_audit_log")
    .select("id, action, old_status, new_status, seat_number, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-lg font-semibold">Order activity</h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Could not load audit log. Apply the latest migration if this table is missing.
        </p>
      </section>
    );
  }

  const rows = (data ?? []) as AuditRow[];

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold">Order activity</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Recent order changes for this event (managers only). Logged automatically.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No activity recorded yet.</p>
      ) : (
        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap justify-between gap-2 border-b border-neutral-100 py-2 dark:border-neutral-800"
            >
              <span className="text-neutral-800 dark:text-neutral-200">
                {actionLabel(row)}
                {row.seat_number != null ? ` · seat ${row.seat_number}` : null}
              </span>
              <time className="text-xs text-neutral-500" dateTime={row.created_at}>
                {new Date(row.created_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
