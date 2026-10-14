import { cn } from "@/lib/utils";

/**
 * Loading placeholder: a soft tile with a light band sweeping across in the brand's three
 * colours (blue, sky, Sun), so waiting reads as "working", not "broken". Still under reduced
 * motion.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-lg bg-foreground/[0.06] dark:bg-white/[0.06]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-skeleton-sweep after:bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,var(--primary)_14%,transparent),color-mix(in_oklch,var(--sky)_16%,transparent),color-mix(in_oklch,var(--sun)_14%,transparent),transparent)]",
        className,
      )}
      {...props}
    />
  );
}

/** Presets shaped like the real components, so nothing shifts when content arrives (CLS). */
export function SkeletonStat() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 sm:p-5" aria-hidden>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-9 rounded-xl" />
      </div>
      <Skeleton className="h-9 w-20" />
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col gap-4 rounded-2xl bg-card p-5 sm:p-6", className)}
      aria-hidden
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3" aria-hidden>
      <Skeleton className="size-10 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** The PageHero's shape: eyebrow chip, title, Sun underline, one line (and an optional slot). */
export function SkeletonHero({
  center = false,
  children,
}: {
  center?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate" aria-hidden>
      <div className="absolute inset-0 -z-10 bg-ambient" />
      <div
        className={cn(
          "container-page flex flex-col gap-4 pt-10 pb-10 sm:pt-14 sm:pb-12",
          center && "items-center",
        )}
      >
        <Skeleton className="h-6 w-36 rounded-full" />
        <Skeleton className="h-11 w-3/4 max-w-xl rounded-xl" />
        <Skeleton className="h-2.5 w-32 rounded-full" />
        <Skeleton className="h-5 w-2/3 max-w-lg" />
        {children}
      </div>
    </section>
  );
}

/** The PageHeader's shape inside the app shell. */
export function SkeletonPageHeader() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      <Skeleton className="h-9 w-2/3 max-w-sm rounded-xl" />
      <Skeleton className="h-2 w-24 rounded-full" />
      <Skeleton className="h-4 w-1/2 max-w-md" />
    </div>
  );
}
