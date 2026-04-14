"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const missingProfile = searchParams.get("error") === "missing_profile";

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const formData = new FormData(e.currentTarget);
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");
      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }

      const supabase = createClient();
      let signError: { message: string } | null = null;
      try {
        const { error } = await Promise.race([
          supabase.auth.signInWithPassword({ email, password }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Sign-in timed out. Check your network and Supabase URL.")),
              25000,
            ),
          ),
        ]);
        signError = error;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed.");
        return;
      }
      if (signError) {
        setError(signError.message);
        return;
      }

      // Full page load so middleware + server see the new session cookies (more reliable on
      // mobile Safari / installed PWA than client router alone).
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Banquet Ordering</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Staff sign-in (Supabase Auth — enable email + password in the dashboard).
        </p>
      </div>
      {missingProfile ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          You are signed in, but there is no row in <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900">profiles</code> for
          your user. Apply the database migration (including the <code className="rounded px-1">on_auth_user_created</code> trigger), then
          either create your user again or insert a profile manually. See <code className="rounded px-1">README.md</code> and{" "}
          <code className="rounded px-1">supabase/bootstrap_manager.sql</code>.
        </p>
      ) : null}
      <form
        method="post"
        action="/login"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(e);
        }}
        className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      >
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            required
            name="email"
            type="email"
            autoComplete="username"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            required
            name="password"
            type="password"
            autoComplete="current-password"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-center text-xs text-neutral-500">
        <Link href="/" className="underline">
          Home
        </Link>
      </p>
    </main>
  );
}
