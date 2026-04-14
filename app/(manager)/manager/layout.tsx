import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { StaffAreaNav } from "@/components/StaffAreaNav";
import { getStaffSession } from "@/lib/auth/session";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getStaffSession();
  if (!user) {
    redirect("/login");
  }
  if (profile?.role !== "manager") {
    redirect("/not-allowed");
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
          <StaffAreaNav current="manager" role={profile.role} />
          <Link
            href="/manager/events/new"
            className="text-neutral-600 underline dark:text-neutral-400"
          >
            New event
          </Link>
        </div>
        <SignOutButton className="text-sm text-neutral-600 underline dark:text-neutral-400" />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
