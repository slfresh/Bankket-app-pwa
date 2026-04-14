import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventControls } from "@/components/manager/EventControls";
import { MenuItemsManager } from "@/components/manager/MenuItemsManager";
import { EventFloorPlan } from "@/components/manager/EventFloorPlan";
import { OrderAuditSection } from "@/components/manager/OrderAuditSection";
import { ServedTodaySection } from "@/components/manager/ServedTodaySection";
import { TableBatchForm } from "@/components/manager/TableBatchForm";
import { TableListManager } from "@/components/manager/TableListManager";

type PageProps = { params: Promise<{ eventId: string }> };

export default async function ManagerEventDetailPage({ params }: PageProps) {
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

  const { data: menu_items } = await supabase
    .from("menu_items")
    .select("id, label, sort_order, course")
    .eq("event_id", eventId)
    .order("course", { ascending: true })
    .order("sort_order", { ascending: true });

  const { data: tables } = await supabase
    .from("banquet_tables")
    .select("id, name, total_seats, layout, floor_x, floor_y, floor_rotation, layout_config")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-4">
      <div>
        <Link
          href="/manager"
          className="text-sm text-neutral-600 underline dark:text-neutral-400"
        >
          ← All events
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{event.name}</h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {new Date(event.event_date).toLocaleString()} · {event.room_location}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {event.is_active ? "Active" : "Inactive"}
            </p>
          </div>
          <EventControls event={event} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/waiter/${eventId}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 underline dark:border-neutral-600"
          >
            Waiter view
          </Link>
          <Link
            href={`/kitchen/${eventId}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 underline dark:border-neutral-600"
          >
            Kitchen board
          </Link>
        </div>
      </div>

      <MenuItemsManager eventId={eventId} items={menu_items ?? []} />
      <TableBatchForm eventId={eventId} tables={tables ?? []} />
      <TableListManager eventId={eventId} tables={tables ?? []} />
      <EventFloorPlan eventId={eventId} tables={tables ?? []} />
      <ServedTodaySection eventId={eventId} />
      <OrderAuditSection eventId={eventId} />
    </main>
  );
}
