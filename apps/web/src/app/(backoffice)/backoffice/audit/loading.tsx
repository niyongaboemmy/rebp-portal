import { Skeleton, SkeletonPageHeader } from "@/components/ui/skeleton";

/** Audit trail: header, the chain status card, filter chips, then the timeline. */
export default function AuditLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <SkeletonPageHeader />
      <Skeleton className="h-24 rounded-3xl" />
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5 pt-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
