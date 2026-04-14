"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        setPending(true);
        void (async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.refresh();
          router.push("/login");
        })();
      }}
    >
      Sign out
    </button>
  );
}
