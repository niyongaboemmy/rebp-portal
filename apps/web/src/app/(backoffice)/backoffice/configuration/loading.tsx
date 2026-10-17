import {
  ConsoleHeaderSkeleton,
  ListPanelSkeleton,
  PillsSkeleton,
} from "@/components/admin/console-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { PANEL } from "@/components/ui/surface";

/** Configuration: header, tabs, the version in force with its form, then the history. */
export default function ConfigurationLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <ConsoleHeaderSkeleton />
      <PillsSkeleton count={3} />
      <div className={`flex flex-col gap-5 ${PANEL}`} aria-hidden>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
      <ListPanelSkeleton rows={3} />
    </div>
  );
}
