"use client";

import { useEffect } from "react";

export default function KitchenError({
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
    <div className="p-6 text-neutral-50">
      <h2 className="text-lg font-semibold">Kitchen board error</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Something went wrong loading the kitchen board. Please try again.
      </p>
      {error.digest ? (
        <p className="mt-1 text-xs text-neutral-500">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 min-h-[44px] rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-100"
      >
        Try again
      </button>
    </div>
  );
}
