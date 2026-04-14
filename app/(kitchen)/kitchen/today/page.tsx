import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KitchenMultiBoard } from "@/components/kitchen/KitchenMultiBoard";
import { getUtcDayRangeIso } from "@/lib/date/utc-day-range";

export default async function KitchenTodayCombinedPage() {
  const supabase = await createClient();
  const { startIso, endIso } = getUtcDayRangeIso();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, name")
    .eq("is_active", true)
    .gte("event_date", startIso)
    .lt("event_date", endIso)
    .order("event_date", { ascending: true });

  if (error) {
    return (
      <main className="p-6">
        <p className="text-lg text-red-400">Could not load events: {error.message}</p>
      </main>
    );
  }

  const list = events ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl">
      <div className="border-b border-neutral-800 px-4 py-4 sm:px-6">
        <Link href="/kitchen" className="text-lg text-neutral-400 underline">
          ← All events
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
          Today (UTC) — combined board
        </h1>
        <p className="mt-2 text-neutral-400">
          All <strong>active</strong> events scheduled on the current UTC calendar day. Open orders
          from every listed event appear below.
        </p>
      </div>
      <KitchenMultiBoard events={list} />
    </main>
  );
}
