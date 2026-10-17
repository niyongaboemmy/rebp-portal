import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard (UX-029): the hero, four numbers, then to-do + applications beside licence + setup. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <div className="flex items-center gap-4 rounded-[1.75rem] bg-card/60 p-5 sm:p-7 dark:bg-surface-2/50">
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-16 max-w-2xl rounded-2xl" />
        </div>
        <Skeleton className="hidden size-32 rounded-full @lg/main:block" />
      </div>
      <div className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-3xl" />
        ))}
      </div>
      <div className="grid items-start gap-4 @4xl/main:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[1.75rem] bg-card/60 p-6 dark:bg-surface-2/50">
            <Skeleton className="h-5 w-40" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-[1.75rem]" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 rounded-[1.75rem]" />
          <Skeleton className="h-72 rounded-[1.75rem]" />
        </div>
      </div>
    </div>
  );
}
