"use client";

export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Manager area error
      </h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
      >
        Try again
      </button>
    </div>
  );
}
