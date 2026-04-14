import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ManagerHomePage() {
  const supabase = await createClient();
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, event_date, room_location, is_active")
    .order("event_date", { ascending: false });

  if (error) {
    return (
      <main className="p-4">
        <p className="text-red-600">Could not load events: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-4">
      <h1 className="text-xl font-semibold">Events</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Open an event to edit menu, tables, and activation.
      </p>
      <ul className="mt-6 space-y-3">
        {(events ?? []).map((ev) => (
          <li key={ev.id}>
            <Link
              href={`/manager/events/${ev.id}`}
              className="flex flex-col rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600"
            >
              <span className="font-medium">{ev.name}</span>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {new Date(ev.event_date).toLocaleString()} · {ev.room_location}
              </span>
              <span className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                {ev.is_active ? "Active" : "Inactive"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {events?.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-600 dark:text-neutral-400">
          No events yet.{" "}
          <Link href="/manager/events/new" className="underline">
            Create one
          </Link>
          .
        </p>
      ) : null}
    </main>
  );
}
