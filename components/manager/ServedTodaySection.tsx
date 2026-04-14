import { createClient } from "@/lib/supabase/server";
import type { MenuCourse } from "@/lib/database.types";
import { menuCourseTitle } from "@/lib/domain/menu-course";

function pickMenuLabel(menuItems: unknown): string {
  if (menuItems && typeof menuItems === "object" && !Array.isArray(menuItems)) {
    const label = (menuItems as { label?: string }).label;
    if (typeof label === "string") return label;
  }
  if (Array.isArray(menuItems) && menuItems[0] && typeof menuItems[0] === "object") {
    const label = (menuItems[0] as { label?: string }).label;
    if (typeof label === "string") return label;
  }
  return "—";
}

function pickTableName(tables: unknown): string {
  if (tables && typeof tables === "object" && !Array.isArray(tables)) {
    const name = (tables as { name?: string }).name;
    if (typeof name === "string") return name;
  }
  if (Array.isArray(tables) && tables[0] && typeof tables[0] === "object") {
    const name = (tables[0] as { name?: string }).name;
    if (typeof name === "string") return name;
  }
  return "Table";
}

function startEndOfLocalDay(): { startIso: string; endIso: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function ServedTodaySection({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const { startIso, endIso } = startEndOfLocalDay();

  const { data: rows, error } = await supabase
    .from("orders")
    .select("id, seat_number, course, updated_at, menu_items(label), banquet_tables(name)")
    .eq("event_id", eventId)
    .eq("status", "served")
    .gte("updated_at", startIso)
    .lte("updated_at", endIso)
    .order("updated_at", { ascending: false });

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold">Served today</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Orders marked served today (by your device&apos;s local calendar day).
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          Could not load served orders: {error.message}
        </p>
      ) : null}
      {!error && (!rows || rows.length === 0) ? (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-500">Nothing served yet today.</p>
      ) : null}
      {!error && rows && rows.length > 0 ? (
        <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
          {rows.map((row) => {
            const course = row.course as MenuCourse;
            const time = new Date(row.updated_at).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                <div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {pickTableName(row.banquet_tables)} · seat {row.seat_number}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {menuCourseTitle(course)} · {pickMenuLabel(row.menu_items)}
                  </span>
                </div>
                <span className="text-xs text-neutral-500">{time}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
