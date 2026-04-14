import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
// Typed `<Database>` is omitted here: the hand-maintained `Database` shape must match what
// `supabase gen types` produces for your CLI version, or `.select()` inference can collapse
// to `never`. After `npm run db:types`, you can restore `createServerClient<Database>(...)`.

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* ignore when called in Server Component without mutable cookies */
          }
        },
      },
    },
  );
}
