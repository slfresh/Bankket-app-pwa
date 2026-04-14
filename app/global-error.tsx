"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-dvh bg-white p-8 text-neutral-900">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm text-neutral-600">Please try again. If the problem continues, reload the app.</p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
