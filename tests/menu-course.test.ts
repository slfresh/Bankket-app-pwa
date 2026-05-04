import { describe, expect, it } from "vitest";
import {
  MENU_COURSE_ORDER,
  menuCourseSortIndex,
  menuCourseTitle,
  menuCourseShortLabel,
} from "@/lib/domain/menu-course";

describe("MENU_COURSE_ORDER", () => {
  it("contains exactly starter, main, dessert", () => {
    expect(MENU_COURSE_ORDER).toEqual(["starter", "main", "dessert"]);
  });
});

describe("menuCourseSortIndex", () => {
  it("returns ascending indices for the standard order", () => {
    expect(menuCourseSortIndex("starter")).toBeLessThan(menuCourseSortIndex("main"));
    expect(menuCourseSortIndex("main")).toBeLessThan(menuCourseSortIndex("dessert"));
  });

  it("returns 99 for unknown course", () => {
    expect(menuCourseSortIndex("brunch" as never)).toBe(99);
  });
});

describe("menuCourseTitle", () => {
  it("returns human-readable titles", () => {
    expect(menuCourseTitle("starter")).toBe("Starter");
    expect(menuCourseTitle("main")).toBe("Main course");
    expect(menuCourseTitle("dessert")).toBe("Dessert");
  });
});

describe("menuCourseShortLabel", () => {
  it("returns short 2-char codes", () => {
    expect(menuCourseShortLabel("starter")).toBe("St");
    expect(menuCourseShortLabel("main")).toBe("Mn");
    expect(menuCourseShortLabel("dessert")).toBe("Ds");
  });
});
