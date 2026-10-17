import {
  ChartPanelSkeleton,
  ConsoleHeaderSkeleton,
  ListPanelSkeleton,
  PillsSkeleton,
} from "@/components/admin/console-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { PANEL } from "@/components/ui/surface";

/** Audit trail: header, the chain and activity panels, the filters, then the timeline. */
export default function AuditLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <ConsoleHeaderSkeleton />
      <div className="grid items-start gap-4 @3xl/main:grid-cols-[1fr_1.6fr]">
        <div className={`flex items-center gap-5 ${PANEL}`} aria-hidden>
          <Skeleton className="size-20 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
        </div>
        <ChartPanelSkeleton />
      </div>
      <PillsSkeleton count={5} />
      <ListPanelSkeleton rows={6} />
    </div>
  );
}
