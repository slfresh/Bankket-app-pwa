import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SeatGrid } from "@/components/waiter/SeatGrid";
import { parseLShapeLayoutConfig } from "@/lib/domain/seat-layout";

type PageProps = { params: Promise<{ eventId: string; tableId: string }> };

export default async function WaiterSeatPage({ params }: PageProps) {
  const { eventId, tableId } = await params;
  const supabase = await createClient();

  const { data: table, error } = await supabase
    .from("banquet_tables")
    .select("id, name, total_seats, event_id, layout, layout_config")
    .eq("id", tableId)
    .maybeSingle();

  if (error || !table || table.event_id !== eventId) {
    notFound();
  }

  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, label, course")
    .eq("event_id", eventId)
    .order("course", { ascending: true })
    .order("sort_order", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-lg p-4">
      <Link
        href={`/waiter/${eventId}`}
        className="text-sm text-neutral-600 underline dark:text-neutral-400"
      >
        ← Tables
      </Link>
      <h1 className="mt-4 text-xl font-semibold">{table.name}</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {table.total_seats} seats ·{" "}
        {table.layout === "block"
          ? "Block layout (seats along two long sides of the table)"
          : table.layout === "l_shape"
            ? "L-shape layout (seats 1–n follow the outer L: top leg, then outer vertical, then bottom leg)"
            : "Round layout"}{" "}
        · tap an empty seat to order.
      </p>
      <div className="mt-6">
        <SeatGrid
          eventId={eventId}
          tableId={tableId}
          tableName={table.name}
          totalSeats={table.total_seats}
          layout={table.layout}
          lShapeConfig={parseLShapeLayoutConfig(table.layout_config)}
          menuItems={menuItems ?? []}
        />
      </div>
    </main>
  );
}
