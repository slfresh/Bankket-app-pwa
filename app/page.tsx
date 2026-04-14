import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/session";

export default async function HomePage() {
  const { user, profile } = await getStaffSession();
  if (!user) {
    redirect("/login");
  }
  if (!profile) {
    redirect("/login?error=missing_profile");
  }

  switch (profile.role) {
    case "manager":
      redirect("/manager");
    case "waiter":
      redirect("/waiter");
    case "kitchen":
      redirect("/kitchen");
    default:
      redirect("/login");
  }
}
