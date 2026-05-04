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
  const base = "inline-flex min-h-[44px] items-center rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950";
  if (variant === "kitchen") {
    return isActive
      ? `${base} text-neutral-100 font-semibold`
      : `${base} text-neutral-400 underline hover:text-neutral-200`;
  }
  return isActive
    ? `${base} text-neutral-100 font-semibold`
    : `${base} text-neutral-400 underline`;
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
