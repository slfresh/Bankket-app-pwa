import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { StaffAreaNav } from "@/components/StaffAreaNav";
import { getStaffSession } from "@/lib/auth/session";

export default async function KitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getStaffSession();
  if (!user) {
    redirect("/login");
  }
  if (profile?.role !== "kitchen" && profile?.role !== "manager") {
    redirect("/not-allowed");
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface-kitchen text-zinc-50">
      <header className="flex items-center justify-between gap-4 border-b border-border-kitchen px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <StaffAreaNav current="kitchen" role={profile.role} variant="kitchen" />
        <SignOutButton className="min-h-[44px] text-sm text-zinc-400 underline" />
      </header>
      <div id="main-content" className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
