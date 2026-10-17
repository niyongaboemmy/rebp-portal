import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";

/** Decision console: the header line, the review summary with its journey, review beside form. */
export default function DecisionConsoleLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <div className="flex flex-col gap-2" aria-hidden>
        <Skeleton className="h-6 w-36 rounded-full" />
        <Skeleton className="h-8 w-2/3 max-w-md rounded-xl" />
      </div>
      <div
        className="flex flex-col gap-5 rounded-[1.75rem] bg-card/60 p-5 sm:p-7 dark:bg-white/[0.03]"
        aria-hidden
      >
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="h-8 w-1/2 max-w-sm rounded-xl" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-6 gap-3 pt-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="mx-auto size-10 rounded-full" />
          ))}
        </div>
      </div>
      <div
        className="grid items-start gap-4 @3xl/main:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
        aria-hidden
      >
        <div className="flex flex-col gap-3 rounded-[1.75rem] bg-card/60 p-5 sm:p-6 dark:bg-white/[0.03]">
          <Skeleton className="h-6 w-40 rounded-lg" />
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-[1.75rem] bg-card/60 p-5 sm:p-6 dark:bg-white/[0.03]">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <div className="grid gap-2.5 @lg/main:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
