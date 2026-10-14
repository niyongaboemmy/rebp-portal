import { Skeleton, SkeletonHero } from "@/components/ui/skeleton";

/** Verify: centred hero with the search bar and the facts row. */
export default function CheckLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy data-route-loading>
      <SkeletonHero center>
        <Skeleton className="mt-2 h-14 w-full max-w-xl rounded-2xl" />
        <div className="flex gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-28" />
          ))}
        </div>
        <Skeleton className="mt-4 size-56 rounded-full opacity-60" />
      </SkeletonHero>
    </div>
  );
}
