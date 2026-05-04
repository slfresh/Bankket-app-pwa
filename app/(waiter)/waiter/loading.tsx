import { SkeletonGrid, SkeletonLine } from "@/components/staff/LoadingSkeleton";

export default function WaiterLoading() {
  return (
    <div className="p-6" role="status" aria-busy aria-label="Loading waiter view">
      <SkeletonLine className="mb-6 h-7 w-48" />
      <SkeletonLine className="mb-4 h-4 w-64" />
      <SkeletonGrid count={4} />
      <span className="sr-only">Loading waiter…</span>
    </div>
  );
}
