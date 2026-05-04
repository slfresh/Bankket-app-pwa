import type { MenuCourse } from "@/lib/database.types";
import type { OrderWithRelations } from "@/lib/orders/order-with-relations";
import { MENU_COURSE_ORDER, menuCourseSortIndex } from "@/lib/domain/menu-course";

/** One aggregated line (same dish + same plate note within a course). */
export type AggregatedTicketLine = {
  /** Stable key for React lists */
  key: string;
  dishLabel: string;
  plateNote: string | null;
  orders: OrderWithRelations[];
};

export type CourseTicketSection = {
  course: MenuCourse;
  lines: AggregatedTicketLine[];
};

export type TableTicket = {
  tableId: string;
  tableName: string;
  courses: CourseTicketSection[];
};

function normWish(w: string | null | undefined): string {
  return (w ?? "").trim();
}

/**
 * Build table → course → aggregated lines for kitchen ticket UI.
 * Guest notes are looked up per seat by the caller when rendering.
 */
export function buildTableTicket(rows: OrderWithRelations[]): TableTicket {
  const tableId = rows[0]?.table_id ?? "";
  const tableName = rows[0]?.banquet_tables?.name ?? "Table";

  const byCourse = new Map<MenuCourse, OrderWithRelations[]>();
  for (const c of MENU_COURSE_ORDER) {
    byCourse.set(c, []);
  }
  for (const o of rows) {
    const list = byCourse.get(o.course) ?? [];
    list.push(o);
    byCourse.set(o.course, list);
  }

  const courses: CourseTicketSection[] = [];
  for (const course of MENU_COURSE_ORDER) {
    const courseRows = byCourse.get(course) ?? [];
    if (courseRows.length === 0) continue;

    courseRows.sort(
      (a, b) =>
        a.seat_number - b.seat_number ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const aggMap = new Map<string, OrderWithRelations[]>();
    for (const o of courseRows) {
      const wish = normWish(o.special_wishes);
      const aggKey = `${o.menu_item_id}\u0000${wish}`;
      const bucket = aggMap.get(aggKey) ?? [];
      bucket.push(o);
      aggMap.set(aggKey, bucket);
    }

    const lines: AggregatedTicketLine[] = Array.from(aggMap.entries()).map(([k, ord]) => {
      const dishLabel = ord[0]?.menu_items?.label ?? "—";
      const plateNote = normWish(ord[0]?.special_wishes) || null;
      return {
        key: `${course}:${k}`,
        dishLabel,
        plateNote,
        orders: ord,
      };
    });

    lines.sort(
      (a, b) =>
        (a.orders[0]?.seat_number ?? 0) - (b.orders[0]?.seat_number ?? 0) ||
        a.dishLabel.localeCompare(b.dishLabel),
    );

    courses.push({ course, lines });
  }

  courses.sort((a, b) => menuCourseSortIndex(a.course) - menuCourseSortIndex(b.course));

  return { tableId, tableName, courses };
}

export function courseStripeClass(course: MenuCourse): string {
  switch (course) {
    case "starter":
      return "border-l-4 border-green-500 pl-3";
    case "main":
      return "border-l-4 border-blue-500 pl-3";
    case "dessert":
      return "border-l-4 border-purple-500 pl-3";
    default:
      return "border-l-4 border-neutral-600 pl-3";
  }
}

export function courseHeadingAccentClass(course: MenuCourse): string {
  switch (course) {
    case "starter":
      return "text-green-400";
    case "main":
      return "text-blue-400";
    case "dessert":
      return "text-purple-300";
    default:
      return "text-neutral-300";
  }
}
