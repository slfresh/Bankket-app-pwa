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
      <h1 className="text-xl font-semibold text-neutral-100">Something went wrong</h1>
      <p className="text-sm text-neutral-400">
        A problem occurred while loading this page. You can try again, or go back to the home screen.
      </p>
      {error.digest ? (
        <p className="text-xs text-neutral-500">Reference: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-[44px] rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
          onClick={() => reset()}
        >
          Try again
        </button>
        <Link
          href="/"
          className="min-h-[44px] inline-flex items-center rounded-lg border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-100"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
