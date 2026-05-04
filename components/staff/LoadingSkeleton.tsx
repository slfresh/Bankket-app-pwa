/**
 * Reusable skeleton pulse blocks for loading states.
 */
export function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-800 ${className ?? "h-4 w-full"}`}
      aria-hidden
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="h-5 w-32 rounded bg-neutral-800" />
      <div className="mt-3 h-4 w-full rounded bg-neutral-800" />
      <div className="mt-2 h-4 w-3/4 rounded bg-neutral-800" />
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
