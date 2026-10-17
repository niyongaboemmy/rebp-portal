import { Skeleton } from "@/components/ui/skeleton";

/** Licence result: the status banner (icon, verdict, number) and the search below. */
export default function CheckResultLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy data-route-loading>
      <div className="bg-surface-2 dark:bg-white/[0.025]">
        <div className="container-page flex flex-col items-center gap-3 py-12 sm:py-16">
          <Skeleton className="size-20 rounded-[1.6rem]" />
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="container-page flex max-w-xl flex-col gap-4 py-12">
        <Skeleton className="mx-auto h-4 w-3/4" />
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    </div>
  );
}
