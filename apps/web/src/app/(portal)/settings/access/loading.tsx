import { SettingsHeroSkeleton } from "@/components/layout/settings-hero";
import { Skeleton } from "@/components/ui/skeleton";

/** My access: the shared hero and tabs, role chips, then the capability groups. */
export default function MyAccessLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <SettingsHeroSkeleton />
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 @2xl/main:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
