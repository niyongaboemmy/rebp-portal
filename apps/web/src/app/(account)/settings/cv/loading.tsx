import { SettingsHeroSkeleton } from "@/components/layout/settings-hero";
import { Skeleton } from "@/components/ui/skeleton";

/** CV: the shared hero and tabs, the editor with its three parts, and the CV beside it. */
export default function CvLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy data-route-loading>
      <SettingsHeroSkeleton />
      <div className="grid items-start gap-5 @5xl/main:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-6 rounded-[1.75rem] bg-card/60 p-5 sm:p-8 dark:bg-white/[0.03]">
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 rounded-2xl" />
            </div>
          ))}
        </div>
        <Skeleton className="h-96 rounded-[1.75rem]" />
      </div>
    </div>
  );
}
