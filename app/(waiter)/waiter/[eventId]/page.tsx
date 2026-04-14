import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WaiterTablePicker } from "@/components/waiter/WaiterTablePicker";

type PageProps = { params: Promise<{ eventId: string }> };

export default async function WaiterTablesPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event, error: evError } = await supabase
    .from("events")
    .select("id, name, event_date, room_location, is_active")
    .eq("id", eventId)
    .maybeSingle();

  if (evError || !event) {
    notFound();
  }

  const { data: tables, error: tError } = await supabase
    .from("banquet_tables")
    .select("id, name, total_seats, layout, layout_config, floor_x, floor_y, floor_rotation")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (tError) {
    return (
      <main className="p-4">
        <p className="text-red-600">Could not load tables: {tError.message}</p>
      </main>
    );
  }

  const { data: openRows } = await supabase
    .from("orders")
    .select("table_id")
    .eq("event_id", eventId)
    .in("status", ["pending", "cooked"]);

  const openOrderCountByTableId: Record<string, number> = {};
  for (const row of openRows ?? []) {
    const tid = row.table_id;
    openOrderCountByTableId[tid] = (openOrderCountByTableId[tid] ?? 0) + 1;
  }

  return (
    <main className="mx-auto w-full max-w-lg p-4">
      <Link
        href="/waiter"
        className="text-sm text-neutral-600 underline dark:text-neutral-400"
      >
        ← Events
      </Link>
      <h1 className="mt-4 text-xl font-semibold">{event.name}</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {!event.is_active ? "This event is inactive — orders may be blocked by policy." : "Tap a table."}
      </p>
      <WaiterTablePicker
        eventId={eventId}
        tables={tables ?? []}
        openOrderCountByTableId={openOrderCountByTableId}
      />
      {tables?.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-600 dark:text-neutral-400">
          No tables configured for this event yet.
        </p>
      ) : null}
    </main>
  );
}
