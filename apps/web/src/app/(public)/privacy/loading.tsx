import { Skeleton, SkeletonHero } from "@/components/ui/skeleton";

/** Privacy: hero with the draft notice, five commitment tiles, then the notice text. */
export default function PrivacyLoading() {
  return (
    <div className="flex flex-col" aria-busy data-route-loading>
      <SkeletonHero>
        <Skeleton className="mt-2 h-14 w-full max-w-2xl rounded-xl" />
      </SkeletonHero>
      <div className="container-page flex flex-col gap-12 pb-20 [&>*]:max-w-4xl">
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl last:sm:col-span-2" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-48 rounded-lg" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-full last:w-2/3" />
          ))}
        </div>
      </div>
    </div>
  );
}
