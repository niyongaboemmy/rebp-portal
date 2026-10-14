import { Skeleton, SkeletonPageHeader } from "@/components/ui/skeleton";

/** My access: header, role chips, then the capability groups. */
export default function MyAccessLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <SkeletonPageHeader />
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
