"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "@/components/icons";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import type { DashLinks } from "./links";
import { TrendChart } from "./trend-chart";

type Range = "7" | "14" | "30";

/**
 * Flow (UX-040): applications coming in against decisions going out, over 7, 14 or 30 days. The
 * headline is the net effect on the backlog — the one number a lead decides staffing on.
 */
export function FlowPanel({
  days,
  links,
}: {
  links: DashLinks;
  /** Oldest first: YYYY-MM-DD with daily in/out counts (30 days). */
  days: { day: string; submitted: number; decided: number }[];
}) {
  const t = useTranslations("boDash.flow");
  const format = useFormatter();
  const [range, setRange] = useState<Range>("14");
  const slice = days.slice(-Number(range));
  const inTotal = slice.reduce((s, d) => s + d.submitted, 0);
  const outTotal = slice.reduce((s, d) => s + d.decided, 0);
  const net = inTotal - outTotal;
  const labels = slice.map((d) =>
    format.dateTime(new Date(`${d.day}T12:00:00Z`), { day: "numeric", month: "short" }),
  );

  return (
    <section
      aria-labelledby="flow-title"
      className="glass flex flex-col gap-4 rounded-[1.75rem] p-5 ring-1 ring-primary/[0.08] sm:p-6 dark:ring-white/[0.06]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="flow-title" className="text-lg">
            {t("title")}
          </h2>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Legend
              color="color-mix(in oklch, var(--primary) 40%, var(--card))"
              label={t("in")}
              value={inTotal}
            />
            <Legend color="var(--primary)" label={t("out")} value={outTotal} />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold num whitespace-nowrap",
              net > 0
                ? "bg-sun text-sun-foreground"
                : net < 0
                  ? "bg-primary-soft text-primary-soft-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {net > 0 ? (
              <ArrowUp className="size-3.5" aria-hidden />
            ) : net < 0 ? (
              <ArrowDown className="size-3.5" aria-hidden />
            ) : null}
            {t(net > 0 ? "growing" : net < 0 ? "shrinking" : "steady", { count: Math.abs(net) })}
          </span>
          <Segmented
            size="sm"
            label={t("range")}
            value={range}
            onValueChange={setRange}
            options={[
              { value: "7", label: t("days", { count: 7 }) },
              { value: "14", label: t("days", { count: 14 }) },
              { value: "30", label: t("days", { count: 30 }) },
            ]}
          />
        </div>
      </div>
      <TrendChart
        key={range}
        height={210}
        label={t("title")}
        labels={labels}
        series={[
          {
            key: "in",
            label: t("in"),
            color: "color-mix(in oklch, var(--primary) 45%, var(--card))",
            values: slice.map((d) => d.submitted),
            area: true,
          },
          {
            key: "out",
            label: t("out"),
            color: "var(--primary)",
            values: slice.map((d) => d.decided),
          },
        ]}
      />
      {/* Guidance from the trend: a growing backlog points to unassigned work, else to the newest. */}
      {(net > 0 ? links.queueUnassigned : links.queueNewest) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-foreground/[0.03] px-3 py-2 dark:bg-white/[0.04]">
          <span className="text-xs text-muted-foreground">
            {t(net > 0 ? "adviceGrowing" : "adviceSteady")}
          </span>
          <Link
            href={(net > 0 ? links.queueUnassigned : links.queueNewest)!}
            className="group inline-flex items-center gap-1 text-xs font-semibold text-link"
          >
            {t(net > 0 ? "assign" : "newest")}
            <ArrowRight
              aria-hidden
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      )}
    </section>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1 w-3 rounded-full" style={{ background: color }} />
      {label}
      <b className="num text-foreground">{value}</b>
    </span>
  );
}
