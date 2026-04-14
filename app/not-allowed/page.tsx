import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { getStaffSession } from "@/lib/auth/session";

export default async function NotAllowedPage() {
  const { user, profile } = await getStaffSession();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          You do not have access to this area
        </h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          Your account is signed in, but this section is restricted to a different staff role. Use the home
          link to open the view that matches your role, or sign out and use another account.
        </p>
      </div>
      {user ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-500">
          Role:{" "}
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            {profile?.role ?? "unknown"}
          </span>
        </p>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-500">You are not signed in.</p>
      )}
      <div className="flex flex-wrap gap-4">
        <Link
          href="/"
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 underline dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
        >
          Home
        </Link>
        {user ? <SignOutButton className="text-sm text-neutral-600 underline dark:text-neutral-400" /> : null}
      </div>
    </main>
  );
}
