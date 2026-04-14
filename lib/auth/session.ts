import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/database.types";

export type StaffProfile = {
  id: string;
  full_name: string | null;
  role: UserRole;
};

export async function getStaffSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { user: null as null, profile: null as null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return { user, profile: null as null };
  }

  return {
    user,
    profile: profile as StaffProfile,
  };
}
