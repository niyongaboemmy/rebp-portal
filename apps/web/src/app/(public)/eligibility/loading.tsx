import { Skeleton, SkeletonHero } from "@/components/ui/skeleton";

/** Eligibility: hero, then the quiz card (progress, question, answer tiles). */
export default function EligibilityLoading() {
  return (
    <div className="flex flex-col" aria-busy data-route-loading>
      <SkeletonHero />
      <div className="container-page flex flex-col gap-5 pb-20 [&>*]:max-w-3xl">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-8 w-2/3 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
