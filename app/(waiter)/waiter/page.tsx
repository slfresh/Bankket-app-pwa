import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function WaiterEventListPage() {
  const supabase = await createClient();
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, event_date, room_location, is_active")
    .eq("is_active", true)
    .order("event_date", { ascending: true });

  if (error) {
    return (
      <main className="p-4">
        <p className="text-red-600">Could not load events: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg p-4">
      <h1 className="text-xl font-semibold">Active events</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Choose an event to take orders.
      </p>
      <ul className="mt-6 space-y-3">
        {(events ?? []).map((ev) => (
          <li key={ev.id}>
            <Link
              href={`/waiter/${ev.id}`}
              className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900"
            >
              <span className="font-medium">{ev.name}</span>
              <span className="mt-1 block text-sm text-neutral-600 dark:text-neutral-400">
                {new Date(ev.event_date).toLocaleString()} · {ev.room_location}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {events?.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-600 dark:text-neutral-400">
          No active events. Ask a manager to activate one.
        </p>
      ) : null}
    </main>
  );
}
