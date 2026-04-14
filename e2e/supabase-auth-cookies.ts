import { createServerClient } from "@supabase/ssr";
import type { BrowserContext, Cookie } from "@playwright/test";

/**
 * Signs in with the Supabase password API from Node and copies the resulting
 * session cookies into the Playwright browser context (avoids flaky UI login / PKCE timing).
 */
export async function addSupabaseSessionCookies(
  context: BrowserContext,
  options: {
    supabaseUrl: string;
    anonKey: string;
    email: string;
    password: string;
  },
): Promise<void> {
  const captured: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(options.supabaseUrl, options.anonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(toSet) {
        for (const c of toSet) {
          captured.push({ name: c.name, value: c.value ?? "", options: (c.options ?? {}) as Record<string, unknown> });
        }
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: options.email.trim(),
    password: options.password,
  });
  if (error) {
    throw new Error(`Supabase sign-in failed: ${error.message}`);
  }

  const playwrightCookies: Cookie[] = [];
  for (const c of captured) {
    if (!c.value) continue;
    const path = typeof c.options.path === "string" ? c.options.path : "/";
    const maxAge = typeof c.options.maxAge === "number" ? c.options.maxAge : undefined;
    const sameSiteRaw = c.options.sameSite;
    const sameSite: "Strict" | "Lax" | "None" | undefined =
      sameSiteRaw === "strict" || sameSiteRaw === "Strict"
        ? "Strict"
        : sameSiteRaw === "none" || sameSiteRaw === "None"
          ? "None"
          : sameSiteRaw === "lax" || sameSiteRaw === "Lax" || sameSiteRaw == null
            ? "Lax"
            : "Lax";

    const expiresSeconds =
      maxAge != null && maxAge > 0
        ? Math.floor(Date.now() / 1000) + maxAge
        : Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;

    const cookie: Cookie = {
      name: c.name,
      value: c.value,
      domain: "127.0.0.1",
      path,
      expires: expiresSeconds,
      httpOnly: Boolean(c.options.httpOnly),
      secure: false,
      sameSite,
    };
    playwrightCookies.push(cookie);
  }

  if (playwrightCookies.length === 0) {
    throw new Error("No Supabase auth cookies were set after sign-in.");
  }

  await context.addCookies(playwrightCookies);
}
