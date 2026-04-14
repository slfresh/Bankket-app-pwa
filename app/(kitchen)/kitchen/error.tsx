"use client";

export default function KitchenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 text-neutral-50">
      <h2 className="text-lg font-semibold">Kitchen board error</h2>
      <p className="mt-2 text-sm text-neutral-400">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
