import { SettingsHeroSkeleton } from "@/components/layout/settings-hero";
import { Skeleton } from "@/components/ui/skeleton";

/** Security settings: the shared hero and tabs, protection summary, then the setting cards. */
export default function SecurityLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <SettingsHeroSkeleton />
      <div className="grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-3xl bg-card/60 p-6 dark:bg-white/[0.03]"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-11 w-40 rounded-full" />
        </div>
      ))}
    </div>
  );
}
