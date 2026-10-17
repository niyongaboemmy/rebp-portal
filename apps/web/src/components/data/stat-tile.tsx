import type { LucideIcon } from "@/components/icons";
import Link from "next/link";
import type { Route } from "next";
import { CountUp } from "@/components/motion/count-up";
import { TiltCard } from "@/components/motion/tilt-card";
import { cn } from "@/lib/utils";

/**
 * KPI tile: one big number, a short label, optional trend graphic. Counts up once when it
 * scrolls into view (skipped under reduced motion / data saver).
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  format = "number",
  hint,
  graphic,
  href,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: number;
  format?: "number" | "percent";
  hint?: React.ReactNode;
  graphic?: React.ReactNode;
  href?: Route;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        {/* min-w-0 + break-word: a one-word label ("Unassigned") never pushes the icon off a 280 px screen. */}
        <span className="min-w-0 text-sm font-medium [overflow-wrap:break-word] hyphens-auto text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Icon className="size-[1.1rem]" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CountUp
            value={value}
            format={format}
            className="text-[clamp(1.75rem,1.4rem+1.2vw,2.5rem)] leading-none font-bold num tracking-tight"
          />
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        {graphic}
      </div>
    </>
  );
  const classes = cn(
    // Glass and a hairline, lit under the pointer (UX-032); no shadow.
    "glass relative flex h-full flex-col justify-between gap-4 rounded-3xl p-4 ring-1 ring-primary/[0.08] sm:p-5 dark:ring-white/[0.06]",
    href &&
      "transition-[transform,box-shadow] duration-(--dur-2) hover:ring-primary/30 active:scale-[0.98] dark:hover:ring-primary/40",
  );
  // The tile tilts a little toward the pointer, like the applicant dashboard's (UX-033).
  const tile = href ? (
    <Link href={href} data-spot className={classes}>
      {body}
    </Link>
  ) : (
    <div data-spot className={classes}>
      {body}
    </div>
  );
  return (
    <TiltCard
      foil={false}
      max={4}
      className={cn("h-full [--tilt-radius:1.5rem] [&>.tilt-card-inner]:h-full", className)}
    >
      {tile}
    </TiltCard>
  );
}
