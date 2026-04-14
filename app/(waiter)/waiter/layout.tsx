import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { StaffAreaNav } from "@/components/StaffAreaNav";
import { getStaffSession } from "@/lib/auth/session";

export default async function WaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getStaffSession();
  if (!user) {
    redirect("/login");
  }
  if (profile?.role !== "waiter" && profile?.role !== "manager") {
    redirect("/not-allowed");
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <StaffAreaNav current="waiter" role={profile.role} />
        <SignOutButton className="text-sm text-neutral-600 underline dark:text-neutral-400" />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
