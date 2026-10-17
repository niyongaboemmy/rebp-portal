import { ConsoleHeaderSkeleton, ListPanelSkeleton } from "@/components/admin/console-skeletons";

/** Register administration: header, the approvals group, then the licence list. */
export default function RegisterLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy data-route-loading>
      <ConsoleHeaderSkeleton />
      <ListPanelSkeleton rows={2} />
      <ListPanelSkeleton rows={6} toolbar />
    </div>
  );
}
