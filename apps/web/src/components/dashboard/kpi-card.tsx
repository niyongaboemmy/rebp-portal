"use client";

import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ClipboardCheck,
  Gavel,
  ScanSearch,
  Timer,
} from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendChart } from "./trend-chart";

/** Icons by key: server components pass a name, never a component (CLAUDE.md). */
const ICONS = { submitted: ClipboardCheck, review: ScanSearch, decision: Gavel, sla: Timer };
export type KpiIcon = keyof typeof ICONS;

/**
 * Counts up to the value on first paint by writing the text node directly (no re-renders); the
 * server-rendered number stays as-is when the user prefers reduced motion.
 */
function useCountUp(target: number) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || target === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    let frame = 0;
    const start = performance.now();
    const step = (time: number) => {
      const p = Math.min(1, (time - start) / 700);
      el.textContent = String(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = String(target);
    };
  }, [target]);
  return ref;
}

/**
 * A pulse KPI (UX-040): label, big number, change against the previous period and a sparkline.
 * The whole card opens a detail dialog with the full interactive trend and the key figures.
 * `goodWhen` says which direction is good, so a rising backlog reads amber, not green.
 */
export function KpiCard({
  icon,
  label,
  value,
  previous,
  goodWhen = "up",
  series,
  labels,
  seriesLabel,
  tone = "default",
  detail,
  href,
  action,
}: {
  icon: KpiIcon;
  label: string;
  value: number;
  /** The same measure over the previous period, for the change chip. */
  previous?: number;
  goodWhen?: "up" | "down";
  /** Daily values for the sparkline and the dialog chart; omit when there is no history. */
  series?: number[];
  labels?: string[];
  seriesLabel: string;
  /** Trend colour from the brand palette: blue (in progress or done), Sun (waiting), red (alert). */
  tone?: "default" | "done" | "waiting" | "alert";
  /** Extra facts for the dialog: short label/value pairs. */
  detail?: { label: string; value: string }[];
  /** The dialog's next step: where to act on this measure. */
  href?: Route;
  action?: string;
}) {
  const t = useTranslations("boDash");
  const countRef = useCountUp(value);
  const Icon = ICONS[icon];
  const delta = previous === undefined ? null : value - previous;
  const good = delta === null || delta === 0 ? null : delta > 0 === (goodWhen === "up");
  const color = {
    default: "var(--primary)",
    done: "var(--primary)",
    waiting: "var(--sun)",
    alert: "var(--destructive)",
  }[tone];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "glass group relative flex flex-col gap-3 overflow-hidden rounded-[1.5rem] p-4 text-left ring-1 ring-primary/[0.08] transition-[transform,box-shadow] duration-(--dur-2) outline-none hover:-translate-y-0.5 hover:ring-primary/25 focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.99] sm:p-5 dark:ring-white/[0.06]",
            tone === "alert" && "ring-destructive/25 dark:ring-destructive/30",
          )}
        >
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-xl",
                {
                  default: "bg-primary-soft text-primary-soft-foreground",
                  done: "bg-primary-soft text-primary-soft-foreground",
                  waiting: "bg-sun text-sun-foreground",
                  alert: "bg-danger-soft text-destructive",
                }[tone],
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{label}</span>
            <ArrowRight
              aria-hidden
              className="size-4 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
            />
          </span>
          <span className="flex items-end justify-between gap-3">
            <span className="flex flex-col gap-1">
              <span key={value} ref={countRef} className="text-3xl leading-none font-bold num">
                {value}
              </span>
              {delta !== null && (
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-bold num",
                    good === null
                      ? "bg-muted text-muted-foreground"
                      : good
                        ? "bg-primary-soft text-primary-soft-foreground"
                        : "bg-muted text-foreground",
                  )}
                >
                  {delta > 0 ? (
                    <ArrowUp className="size-3" aria-hidden />
                  ) : delta < 0 ? (
                    <ArrowDown className="size-3" aria-hidden />
                  ) : null}
                  {delta > 0 ? "+" : ""}
                  {delta}
                  <span className="sr-only"> {t("vsPrevious")}</span>
                </span>
              )}
            </span>
            {series && labels && (
              <TrendChart
                compact
                height={44}
                className="w-28 shrink-0"
                label={seriesLabel}
                labels={labels}
                series={[{ key: "v", label: seriesLabel, color, values: series, area: true }]}
              />
            )}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-5 text-link" aria-hidden />
            {label}
          </DialogTitle>
          <DialogDescription>{seriesLabel}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact label={t("now")} value={String(value)} strong />
          {previous !== undefined && <Fact label={t("previous")} value={String(previous)} />}
          {detail?.map((d) => (
            <Fact key={d.label} label={d.label} value={d.value} />
          ))}
        </div>
        {series && labels && (
          <TrendChart
            height={220}
            label={seriesLabel}
            labels={labels}
            series={[{ key: "v", label, color, values: series, area: true }]}
          />
        )}
        {href && action && (
          <Button asChild className="group justify-self-end rounded-full">
            <Link href={href}>
              {action}
              <ArrowRight
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-foreground/[0.03] px-3 py-2 dark:bg-white/[0.04]">
      <span className="text-[0.6875rem] text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-bold num", strong && "text-link")}>{value}</span>
    </div>
  );
}
