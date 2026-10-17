import { SettingsHeroSkeleton } from "@/components/layout/settings-hero";
import { Skeleton } from "@/components/ui/skeleton";

/** Profile: the shared hero and tabs, then the step tabs and one step of fields. */
export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy data-route-loading>
      <SettingsHeroSkeleton />
      <div className="flex flex-col gap-6 rounded-[1.75rem] bg-card/60 p-5 sm:p-8 dark:bg-white/[0.03]">
        <div className="flex gap-1.5 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="grid gap-4 @2xl/main:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
