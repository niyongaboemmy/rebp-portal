import { Skeleton, SkeletonPageHeader, SkeletonStat } from "@/components/ui/skeleton";

/** Back office overview: header, four stat tiles, then the work queues. */
export default function BackofficeLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <SkeletonPageHeader />
      <div className="grid gap-4 sm:grid-cols-2 @3xl/main:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonStat key={i} />
        ))}
      </div>
      <div className="grid gap-4 @3xl/main:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  );
}
