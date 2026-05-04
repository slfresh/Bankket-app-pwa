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
    <main className="mx-auto w-full max-w-lg px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4">
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/95 dark:supports-[backdrop-filter]:bg-neutral-950/80">
        <Link
          href={`/waiter/${eventId}`}
          className="min-h-[44px] inline-flex items-center text-sm text-neutral-600 underline dark:text-neutral-400"
        >
          ← Tables
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{table.name}</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {table.total_seats} seats ·{" "}
          {table.layout === "block"
            ? "Block layout (seats along two long sides of the table)"
            : table.layout === "l_shape"
              ? "L-shape layout (seats 1–n follow the outer L: top leg, then outer vertical, then bottom leg)"
              : "Round layout"}{" "}
          · tap an empty seat to order.
        </p>
      </div>
      <div className="mt-2">
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
