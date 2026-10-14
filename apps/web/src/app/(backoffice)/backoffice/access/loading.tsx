import { Skeleton, SkeletonPageHeader, SkeletonRow } from "@/components/ui/skeleton";

/** Access console: header, tabs, toolbar, then the people list. */
export default function AccessLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <SkeletonPageHeader />
      <Skeleton className="h-11 w-64 rounded-full" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-12 flex-1 rounded-lg" />
        <Skeleton className="h-12 w-56 rounded-lg" />
      </div>
      <div className="rounded-3xl bg-card/60 px-5 dark:bg-white/[0.03]">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}
