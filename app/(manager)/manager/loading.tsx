import { SkeletonGrid, SkeletonLine } from "@/components/staff/LoadingSkeleton";

export default function ManagerLoading() {
  return (
    <div className="p-6" role="status" aria-busy aria-label="Loading manager view">
      <SkeletonLine className="mb-6 h-7 w-48" />
      <SkeletonLine className="mb-4 h-4 w-64" />
      <SkeletonGrid count={3} />
      <span className="sr-only">Loading manager…</span>
    </div>
  );
}
