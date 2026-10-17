import { Skeleton, SkeletonPageHeader, SkeletonRow } from "@/components/ui/skeleton";

/** Decisions queue: the header, then the list of signed reviews. */
export default function DecisionsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <SkeletonPageHeader />
      <div className="rounded-2xl bg-card/60 px-4 dark:bg-white/[0.03]" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1">
              <SkeletonRow />
            </div>
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
