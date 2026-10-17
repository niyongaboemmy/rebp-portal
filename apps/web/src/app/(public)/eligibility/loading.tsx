import { Skeleton, SkeletonHero } from "@/components/ui/skeleton";

/** Eligibility: compact hero, then the question card beside the answers panel. */
export default function EligibilityLoading() {
  return (
    <div className="flex flex-col" aria-busy data-route-loading>
      <SkeletonHero />
      <div className="container-page grid items-start gap-5 pb-20 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="flex flex-col gap-6 rounded-[1.75rem] bg-foreground/[0.03] p-5 sm:p-8 dark:bg-white/[0.03]">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex items-start gap-3.5">
            <Skeleton className="size-11 rounded-2xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-7 w-2/3 rounded-xl" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-56 rounded-[1.75rem]" />
      </div>
    </div>
  );
}
