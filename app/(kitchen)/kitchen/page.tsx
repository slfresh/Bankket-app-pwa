import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUtcDayRangeIso } from "@/lib/date/utc-day-range";

export default async function KitchenEventPickerPage() {
  const supabase = await createClient();
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, event_date, room_location, is_active")
    .eq("is_active", true)
    .order("event_date", { ascending: true });

  if (error) {
    return (
      <main className="p-6">
        <p className="text-lg text-red-400">Could not load events: {error.message}</p>
      </main>
    );
  }

  const list = events ?? [];
  const { startIso, endIso } = getUtcDayRangeIso();
  const todayEvents = list.filter((ev) => ev.event_date >= startIso && ev.event_date < endIso);
  const otherEvents = list.filter((ev) => ev.event_date < startIso || ev.event_date >= endIso);

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <h1 className="text-3xl font-bold tracking-tight">Select event</h1>
      <p className="mt-2 text-lg text-neutral-400">Open the live board for an active banquet.</p>
      {todayEvents.length > 0 ? (
        <p className="mt-4">
          <Link
            href="/kitchen/today"
            className="rounded-xl border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-base font-semibold text-amber-100 underline-offset-2 hover:underline"
          >
            Open combined board for today (UTC) — {todayEvents.length} event
            {todayEvents.length === 1 ? "" : "s"}
          </Link>
        </p>
      ) : null}

      {todayEvents.length > 0 ? (
        <>
          <h2 className="mt-10 text-xl font-semibold text-neutral-200">Today (UTC)</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {todayEvents.map((ev) => (
              <li key={ev.id}>
                <Link
                  href={`/kitchen/${ev.id}`}
                  className="block rounded-2xl border border-amber-800/50 bg-neutral-900 p-6 text-xl font-semibold shadow-lg transition hover:border-amber-600"
                >
                  {ev.name}
                  <span className="mt-2 block text-base font-normal text-neutral-400">
                    {new Date(ev.event_date).toLocaleString()} · {ev.room_location}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {otherEvents.length > 0 ? (
        <>
          <h2 className="mt-10 text-xl font-semibold text-neutral-200">Other active events</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {otherEvents.map((ev) => (
              <li key={ev.id}>
                <Link
                  href={`/kitchen/${ev.id}`}
                  className="block rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-xl font-semibold shadow-lg transition hover:border-neutral-600"
                >
                  {ev.name}
                  <span className="mt-2 block text-base font-normal text-neutral-400">
                    {new Date(ev.event_date).toLocaleString()} · {ev.room_location}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {list.length === 0 ? (
        <p className="mt-10 text-lg text-neutral-500">No active events right now.</p>
      ) : null}
    </main>
  );
}
