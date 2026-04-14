import type { MenuCourse } from "@/lib/database.types";

export const MENU_COURSE_ORDER: MenuCourse[] = ["starter", "main", "dessert"];

export function menuCourseSortIndex(course: MenuCourse): number {
  const i = MENU_COURSE_ORDER.indexOf(course);
  return i === -1 ? 99 : i;
}

export function menuCourseTitle(course: MenuCourse): string {
  switch (course) {
    case "starter":
      return "Starter";
    case "main":
      return "Main course";
    case "dessert":
      return "Dessert";
    default:
      return course;
  }
}

export function menuCourseShortLabel(course: MenuCourse): string {
  switch (course) {
    case "starter":
      return "St";
    case "main":
      return "Mn";
    case "dessert":
      return "Ds";
    default:
      return "?";
  }
}
