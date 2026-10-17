import {
  ChartPanelSkeleton,
  ConsoleHeaderSkeleton,
  StatTilesSkeleton,
} from "@/components/admin/console-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Reports: header, then each section's KPI tiles and chart panels. */
export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <ConsoleHeaderSkeleton />
      <Skeleton className="h-7 w-40 rounded-xl" />
      <StatTilesSkeleton />
      <div className="grid grid-cols-1 items-start gap-4 @3xl/main:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <ChartPanelSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
