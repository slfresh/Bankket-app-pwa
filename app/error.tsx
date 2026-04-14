"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Something went wrong</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        A problem occurred while loading this page. You can try again, or go back to the home screen.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          onClick={() => reset()}
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 dark:border-neutral-600 dark:text-neutral-100"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
