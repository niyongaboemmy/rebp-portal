import { Skeleton } from "@/components/ui/skeleton";
import { PANEL } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { LIST_GROUP } from "./surfaces";

/**
 * Route-loading shapes for the back-office consoles (register, finance, reports, configuration,
 * audit, access): the hero header, StatTiles, panels and list groups, so nothing shifts when the
 * page arrives (CLS).
 */
export function ConsoleHeaderSkeleton() {
  return (
    <div
      className="hero-surface flex items-center gap-4 overflow-hidden rounded-[1.75rem] p-5 sm:p-7"
      aria-hidden
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="h-8 w-2/3 max-w-sm rounded-xl" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="flex flex-wrap gap-4 pt-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="hidden h-28 w-24 shrink-0 rounded-[1.75rem] @lg/main:block" />
    </div>
  );
}

export function StatTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 @md/main:grid-cols-2 @md/main:gap-4 @5xl/main:grid-cols-4"
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="glass flex flex-col gap-4 rounded-3xl p-4 ring-1 ring-primary/[0.08] sm:p-5 dark:ring-white/[0.06]"
        >
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-9 rounded-xl" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      ))}
    </div>
  );
}

/** A panel with a title and a list group of rows. */
export function ListPanelSkeleton({
  rows = 5,
  toolbar = false,
  className,
}: {
  rows?: number;
  toolbar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", PANEL, className)} aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-16" />
      </div>
      {toolbar && <Skeleton className="h-11 w-full rounded-xl" />}
      <div className={LIST_GROUP}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3.5 py-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="hidden h-6 w-20 rounded-full @xl/main:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A panel holding a chart. */
export function ChartPanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", PANEL, className)} aria-hidden>
      <Skeleton className="h-5 w-44" />
      <div className="flex flex-col gap-3">
        {[80, 62, 45, 30].map((w) => (
          <Skeleton key={w} className="h-3 rounded-full" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Soft pill filters in their track. */
export function PillsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="flex w-fit max-w-full gap-1 overflow-hidden rounded-full bg-foreground/[0.04] p-1 dark:bg-surface-2/60"
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-9 w-20 rounded-full" />
      ))}
    </div>
  );
}
