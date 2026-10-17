import {
  ChartPanelSkeleton,
  ConsoleHeaderSkeleton,
  ListPanelSkeleton,
  StatTilesSkeleton,
} from "@/components/admin/console-skeletons";

/** Finance: header, four KPI tiles, methods and awaiting payment, then recent payments. */
export default function FinanceLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <ConsoleHeaderSkeleton />
      <StatTilesSkeleton />
      <div className="grid items-start gap-4 @3xl/main:grid-cols-[1fr_1.4fr]">
        <ChartPanelSkeleton />
        <ListPanelSkeleton rows={3} />
      </div>
      <ListPanelSkeleton rows={6} />
    </div>
  );
}
