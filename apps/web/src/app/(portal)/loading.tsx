import { Skeleton, SkeletonPageHeader } from "@/components/ui/skeleton";

/** UX-009: a portal page streaming in: header, three tiles, a content block. */
export default function PortalLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy data-route-loading>
      <SkeletonPageHeader />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}
