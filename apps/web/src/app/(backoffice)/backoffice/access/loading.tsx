import {
  ConsoleHeaderSkeleton,
  ListPanelSkeleton,
  PillsSkeleton,
} from "@/components/admin/console-skeletons";

/** Access console: header, tabs, then the people panel (toolbar and list). */
export default function AccessLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <ConsoleHeaderSkeleton />
      <PillsSkeleton count={2} />
      <ListPanelSkeleton rows={6} toolbar />
    </div>
  );
}
