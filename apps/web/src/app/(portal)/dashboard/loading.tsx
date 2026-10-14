import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard: greeting, the journey panel + setup ring, then licence wallet + activity. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Skeleton className="h-72 rounded-3xl" />
        <div className="flex flex-col gap-4 rounded-3xl bg-card/60 p-6 dark:bg-white/[0.03]">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-3xl" />
        <div className="flex flex-col gap-4 rounded-3xl bg-card/60 p-6 dark:bg-white/[0.03]">
          <Skeleton className="h-5 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
