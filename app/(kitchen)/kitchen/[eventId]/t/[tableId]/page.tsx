import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SeatGrid } from "@/components/waiter/SeatGrid";
import { parseLShapeLayoutConfig } from "@/lib/domain/seat-layout";

type PageProps = { params: Promise<{ eventId: string; tableId: string }> };

export default async function KitchenTableSeatPage({ params }: PageProps) {
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
        href={`/kitchen/${eventId}`}
        className="text-sm text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
      >
        ← Kitchen board
      </Link>
      <h1 className="mt-4 text-xl font-semibold text-white">{table.name}</h1>
      <p className="mt-1 text-sm text-neutral-400">
        {table.total_seats} seats ·{" "}
        {table.layout === "block"
          ? "Block layout"
          : table.layout === "l_shape"
            ? "L-shape layout"
            : "Round layout"}
        . View only — tap a seat to see what was ordered. Mark dishes cooked or served from the main
        board.
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
          readOnly
        />
      </div>
    </main>
  );
}
