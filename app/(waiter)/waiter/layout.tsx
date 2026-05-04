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
    <div className="flex min-h-dvh flex-1 flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800 bg-neutral-950 px-4 py-3">
        <StaffAreaNav current="waiter" role={profile.role} />
        <SignOutButton className="min-h-[44px] rounded-md px-2 py-1 text-sm text-neutral-400 underline outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950" />
      </header>
      <div id="main-content" className="flex-1">{children}</div>
    </div>
  );
}
