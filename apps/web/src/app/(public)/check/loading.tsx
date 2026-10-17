import { Skeleton } from "@/components/ui/skeleton";

/** Verify: the search column beside the map teaser card. */
export default function CheckLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy data-route-loading>
      <div className="container-page grid items-start gap-10 pt-8 pb-12 sm:pt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <div className="flex flex-col gap-5 lg:pt-10">
          <Skeleton className="h-6 w-44 rounded-full" />
          <Skeleton className="h-14 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-20 w-full rounded-[1.75rem]" />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-32 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-[30rem] w-full rounded-[2rem]" />
      </div>
    </div>
  );
}
