import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { CountUp } from "@/components/motion/count-up";
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
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Icon className="size-[1.1rem]" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
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
    "spotlight flex flex-col justify-between gap-4 rounded-2xl border bg-card p-4 raised sm:p-5",
    href &&
      "transition-[transform,border-color] duration-(--dur-2) hover:border-primary/40 active:scale-[0.98]",
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
