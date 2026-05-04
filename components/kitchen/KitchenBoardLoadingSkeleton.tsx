import { SkeletonCard, SkeletonLine } from "@/components/staff/LoadingSkeleton";

/**
 * Kitchen-shaped skeleton: floor panel + ticket column (matches KitchenBoard md/xl split).
 */
export function KitchenBoardLoadingSkeleton() {
  return (
    <div
      className="min-h-[50vh] border-t border-border-kitchen bg-surface-kitchen p-4 sm:p-6"
      role="status"
      aria-busy
      aria-label="Loading kitchen board"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SkeletonLine className="h-9 w-[min(28rem,100%)] max-w-xl rounded-lg" />
        <SkeletonLine className="h-11 w-full sm:w-[10rem]" />
      </div>
      <div className="flex min-h-[min(70vh,40rem)] flex-col gap-4 md:flex-row xl:gap-6">
        <aside className="flex min-h-[12rem] min-w-0 flex-[0_1_42%] flex-col rounded-xl border border-border-kitchen bg-surface-kitchen-elevated/40 p-3">
          <SkeletonLine className="mb-2 h-6 w-32" />
          <div className="grid flex-1 grid-cols-4 gap-2 opacity-70 sm:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-lg bg-neutral-800/80 ring-1 ring-neutral-700/80"
              />
            ))}
          </div>
        </aside>
        <section className="min-h-0 min-w-0 flex-[1_1_58%] overflow-hidden rounded-xl border border-border-kitchen bg-surface-kitchen-elevated/20 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <SkeletonLine className="h-14 w-[7.5rem] rounded-lg md:w-[8.75rem]" />
            <SkeletonLine className="h-14 w-[7.5rem] rounded-lg md:w-[8.75rem]" />
            <SkeletonLine className="h-14 w-[7.5rem] rounded-lg md:w-[8.75rem]" />
          </div>
          <div className="space-y-3 xl:columns-2 xl:gap-x-4 xl:space-y-0 [&>*]:mb-3 [&>*]:break-inside-avoid xl:[&>*]:mb-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </section>
      </div>
      <span className="sr-only">Loading kitchen board…</span>
    </div>
  );
}
