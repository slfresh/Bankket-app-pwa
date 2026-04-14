import Link from "next/link";
import type { UserRole } from "@/lib/database.types";

type StaffArea = "manager" | "waiter" | "kitchen";

type StaffAreaNavProps = {
  current: StaffArea;
  role: UserRole;
  /** kitchen header uses light links on dark bg */
  variant?: "default" | "kitchen";
};

function navClass(
  isActive: boolean,
  variant: "default" | "kitchen",
): string {
  if (variant === "kitchen") {
    return isActive
      ? "text-neutral-100 font-semibold"
      : "text-neutral-400 underline hover:text-neutral-200";
  }
  return isActive
    ? "text-neutral-900 font-semibold dark:text-neutral-100"
    : "text-neutral-600 underline dark:text-neutral-400";
}

/**
 * Links to other staff areas. Managers can open all three; waiter/kitchen only see their own.
 */
export function StaffAreaNav({ current, role, variant = "default" }: StaffAreaNavProps) {
  const isManager = role === "manager";

  const show = (area: StaffArea) =>
    isManager || current === area;

  return (
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label="Staff areas">
      {show("manager") ? (
        <Link href="/manager" className={navClass(current === "manager", variant)}>
          Manager
        </Link>
      ) : null}
      {show("waiter") ? (
        <Link href="/waiter" className={navClass(current === "waiter", variant)}>
          Waiter
        </Link>
      ) : null}
      {show("kitchen") ? (
        <Link href="/kitchen" className={navClass(current === "kitchen", variant)}>
          Kitchen
        </Link>
      ) : null}
      {(isManager || role === "kitchen") && current === "kitchen" ? (
        <Link href="/kitchen/today" className={navClass(false, variant)}>
          Today (UTC)
        </Link>
      ) : null}
    </nav>
  );
}
