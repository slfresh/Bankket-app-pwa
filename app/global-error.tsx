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
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-neutral-950 p-8 text-neutral-100">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm text-neutral-400">Please try again. If the problem continues, reload the app.</p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
