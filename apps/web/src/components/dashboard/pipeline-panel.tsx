"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ArrowRight, Check } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RefLink } from "./insight-panels";
import { withValue, type DashLinks } from "./links";

export interface PipelineStageData {
  stage:
    "SUBMITTED" | "UNDER_REVIEW" | "ACTION_REQUIRED" | "FURTHER_ASSESSMENT" | "PENDING_DECISION";
  count: number;
  avgAgeDays: number;
  oldest: { referenceNo: string; days: number }[];
}

/**
 * Stage colours (ADR-009 v17): a blue ramp for work in hand; Sun yellow marks only "awaiting
 * decision", so what awaits stands out.
 */
const STAGE_COLOR: Record<PipelineStageData["stage"], string> = {
  SUBMITTED: "color-mix(in oklch, var(--primary) 30%, var(--card))",
  UNDER_REVIEW: "color-mix(in oklch, var(--primary) 50%, var(--card))",
  ACTION_REQUIRED: "var(--primary)",
  FURTHER_ASSESSMENT: "color-mix(in oklch, var(--primary) 72%, var(--card))",
  PENDING_DECISION: "var(--sun)",
};
/** The bar's soft fill: the stage colour washed into the card, never a solid slab. */
const soft = (color: string) => `color-mix(in oklch, ${color} 32%, var(--card))`;

/**
 * The review pipeline as one segmented bar (UX-040): every open file by stage, wide where work piles
 * up. Each stage opens a detail dialog — how many, how long they have waited, the oldest files.
 */
export function PipelinePanel({
  stages,
  decidedThisWeek,
  links,
}: {
  links: DashLinks;
  stages: PipelineStageData[];
  decidedThisWeek: number;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState<PipelineStageData["stage"] | null>(null);
  const [hover, setHover] = useState<PipelineStageData["stage"] | null>(null);
  const total = stages.reduce((s, x) => s + x.count, 0);
  const selected = stages.find((s) => s.stage === open);
  // Awaiting decision opens the decisions console; other stages open the queue filtered to them.
  const stageHref =
    selected &&
    (selected.stage === "PENDING_DECISION" && links.decisions
      ? links.decisions
      : withValue(links.queueStatus, selected.stage));
  const waitLabel = (days: number) =>
    days < 1 ? t("boDash.underDay") : `~${t("boDash.days", { count: Math.round(days) })}`;

  return (
    <section
      aria-labelledby="pipeline-title"
      className="glass flex flex-col gap-4 rounded-[1.75rem] p-5 ring-1 ring-primary/[0.08] sm:p-6 dark:ring-white/[0.06]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pipeline-title" className="text-lg">
          {t("boDash.pipeline.title")}
        </h2>
        <span className="inline-flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            <b className="text-base num text-foreground">{total}</b> {t("boDash.pipeline.open")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="size-3.5 text-link" aria-hidden />
            <b className="num text-foreground">{decidedThisWeek}</b> {t("boDash.pipeline.week")}
          </span>
        </span>
      </div>

      {/* The bar: proportional segments, each a button. */}
      <div className="flex h-10 w-full gap-1 overflow-hidden rounded-2xl" role="list">
        {total === 0 ? (
          <span className="flex-1 rounded-2xl bg-foreground/[0.05]" />
        ) : (
          stages
            .filter((s) => s.count > 0)
            .map((s, i) => (
              <button
                key={s.stage}
                type="button"
                role="listitem"
                onClick={() => setOpen(s.stage)}
                onPointerEnter={() => setHover(s.stage)}
                onPointerLeave={() => setHover(null)}
                aria-label={`${t(`status.application.${s.stage}`)}: ${s.count}`}
                className="relative flex min-w-10 origin-left animate-in items-center justify-center rounded-xl text-sm font-bold transition-[filter,transform] duration-(--dur-2) fill-mode-both outline-none fade-in slide-in-from-left-4 hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98]"
                style={{
                  flexGrow: s.count,
                  background: soft(STAGE_COLOR[s.stage]),
                  animationDelay: `${i * 70}ms`,
                  opacity: hover && hover !== s.stage ? 0.55 : 1,
                }}
              >
                {/* A chip keeps the count readable on every stage colour, in both themes. */}
                <span className="rounded-full bg-card/90 px-2 py-0.5 text-xs num text-foreground dark:bg-background/80">
                  {s.count}
                </span>
              </button>
            ))
        )}
      </div>

      {/* Stages as rows: a proportion bar, the count and the typical wait; each opens the stage. */}
      <ul className="flex flex-col gap-0.5">
        {stages.map((s) => (
          <li key={s.stage}>
            <button
              type="button"
              onClick={() => setOpen(s.stage)}
              onPointerEnter={() => setHover(s.stage)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(s.stage)}
              onBlur={() => setHover(null)}
              className={cn(
                "grid w-full grid-cols-[0.625rem_minmax(0,1fr)_4.5rem_2rem] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring/40 dark:hover:bg-white/[0.05]",
                hover === s.stage && "bg-foreground/[0.04] dark:bg-white/[0.05]",
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ background: STAGE_COLOR[s.stage] }}
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-xs text-muted-foreground">
                  {t(`status.application.${s.stage}`)}
                </span>
                <span className="h-1 overflow-hidden rounded-full bg-foreground/[0.06] dark:bg-white/[0.06]">
                  <span
                    className="block h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${total ? (s.count / total) * 100 : 0}%`,
                      background: STAGE_COLOR[s.stage],
                    }}
                  />
                </span>
              </span>
              <span className="text-right text-[0.6875rem] num text-muted-foreground">
                {s.count > 0 ? waitLabel(s.avgAgeDays) : ""}
              </span>
              <span className="text-right text-sm font-bold num">{s.count}</span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full"
                    style={{ background: STAGE_COLOR[selected.stage] }}
                  />
                  {t(`status.application.${selected.stage}`)}
                </DialogTitle>
                <DialogDescription>{t("boDash.pipeline.detail")}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-2">
                <Stat label={t("boDash.pipeline.files")} value={selected.count} />
                <Stat
                  label={t("boDash.pipeline.share")}
                  value={`${total ? Math.round((selected.count / total) * 100) : 0}%`}
                />
                <Stat label={t("boDash.pipeline.avgWait")} value={waitLabel(selected.avgAgeDays)} />
              </div>
              {selected.oldest.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t("boDash.pipeline.oldest")}
                  </span>
                  <ul className="flex flex-col gap-1.5">
                    {selected.oldest.map((o) => {
                      const max = Math.max(1, ...selected.oldest.map((x) => x.days));
                      return (
                        <li key={o.referenceNo} className="flex items-center gap-3 text-sm">
                          <span className="w-36 shrink-0">
                            <RefLink base={links.queueSearch} referenceNo={o.referenceNo} />
                          </span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${(o.days / max) * 100}%`,
                                background: STAGE_COLOR[selected.stage],
                              }}
                            />
                          </span>
                          <span className="w-14 text-right text-xs font-bold num">
                            {t("boDash.days", { count: o.days })}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {stageHref && selected.count > 0 && (
                <Button asChild className="group justify-self-end rounded-full">
                  <Link href={stageHref}>
                    {t("boDash.actions.viewStage", { count: selected.count })}
                    <ArrowRight
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-foreground/[0.03] px-3 py-2 dark:bg-white/[0.04]">
      <span className="text-[0.6875rem] text-muted-foreground">{label}</span>
      <span className="text-lg font-bold num">{value}</span>
    </div>
  );
}
