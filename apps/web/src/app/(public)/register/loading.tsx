import { Skeleton, SkeletonHero } from "@/components/ui/skeleton";

/** Directory: hero with search and two chip rows, then the results area. */
export default function RegisterLoading() {
  return (
    <div className="flex flex-col" aria-busy data-route-loading>
      <SkeletonHero>
        <Skeleton className="mt-2 h-14 w-full max-w-2xl rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-9 w-16 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      </SkeletonHero>
      <div className="container-page pb-20">
        <Skeleton className="h-80 rounded-[2rem]" />
      </div>
    </div>
  );
}
