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
    <div className="flex min-h-dvh flex-1 flex-col bg-neutral-950 text-neutral-50">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800 px-4 py-3">
        <StaffAreaNav current="kitchen" role={profile.role} variant="kitchen" />
        <SignOutButton className="text-sm text-neutral-400 underline" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
