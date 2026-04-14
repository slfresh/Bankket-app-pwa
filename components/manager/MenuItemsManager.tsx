"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { MenuCourse } from "@/lib/database.types";
import { MENU_COURSE_ORDER, menuCourseTitle } from "@/lib/domain/menu-course";
import { addMenuItem, deleteMenuItem } from "@/lib/actions/manager";

type MenuRow = {
  id: string;
  label: string;
  sort_order: number;
  course: MenuCourse;
};

export function MenuItemsManager({
  eventId,
  items,
}: {
  eventId: string;
  items: MenuRow[];
}) {
  const router = useRouter();
  const [labels, setLabels] = useState<Record<MenuCourse, string>>({
    starter: "",
    main: "",
    dessert: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byCourse = useMemo(() => {
    const m = new Map<MenuCourse, MenuRow[]>();
    for (const c of MENU_COURSE_ORDER) {
      m.set(c, []);
    }
    for (const it of items) {
      const list = m.get(it.course) ?? [];
      list.push(it);
      m.set(it.course, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order);
    }
    return m;
  }, [items]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold">Menu by course</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Up to three choices per course (starter, main, dessert). Waiters place one open order per seat
        per course.
      </p>

      <div className="mt-6 space-y-8">
        {MENU_COURSE_ORDER.map((course) => {
          const list = byCourse.get(course) ?? [];
          const atLimit = list.length >= 3;
          return (
            <div key={course}>
              <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
                {menuCourseTitle(course)}
              </h3>
              <ul className="mt-2 space-y-2">
                {list.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-neutral-100 px-3 py-2 dark:border-neutral-800"
                  >
                    <span>{item.label}</span>
                    <button
                      type="button"
                      disabled={pending}
                      className="text-sm text-red-700 underline dark:text-red-300"
                      onClick={() => {
                        startTransition(async () => {
                          setError(null);
                          const res = await deleteMenuItem(item.id, eventId);
                          if ("error" in res && res.error) {
                            setError(res.error);
                            return;
                          }
                          router.refresh();
                        });
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {atLimit ? (
                <p className="mt-2 text-sm text-neutral-500">Maximum of 3 items for this course.</p>
              ) : (
                <form
                  method="post"
                  action="#"
                  noValidate
                  className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const label = labels[course].trim();
                    if (!label) return;
                    startTransition(async () => {
                      setError(null);
                      const res = await addMenuItem(eventId, label, course);
                      if ("error" in res && res.error) {
                        setError(res.error);
                      } else {
                        setLabels((prev) => ({ ...prev, [course]: "" }));
                        router.refresh();
                      }
                    });
                  }}
                >
                  <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
                    Add option
                    <input
                      value={labels[course]}
                      onChange={(e) =>
                        setLabels((prev) => ({ ...prev, [course]: e.target.value }))
                      }
                      maxLength={200}
                      placeholder="e.g. Soup"
                      className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={pending || !labels[course].trim()}
                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
