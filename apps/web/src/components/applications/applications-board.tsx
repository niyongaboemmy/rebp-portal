"use client";

import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ApplicationStatus } from "@rebp/contracts";
import { ArrowRight, Bell, Clock3, FilePlus2 } from "@/components/icons";
import { ProgressRing } from "@/components/data/progress-ring";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import { lifecycleOf } from "@/lib/lifecycle";
import { relativeLabel } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { ApplicationStatusBadge } from "./status-badges";
import { LifecycleTrack } from "./lifecycle-track";

export interface BoardItem {
  id: string;
  reference: string;
  category: string;
  /** The category's short code, for the card's tile (e.g. "REA"). */
  code: string;
  type: string;
  status: ApplicationStatus;
  lastStep: string | null;
  /** Draft progress (share of sections complete), when a draft. */
  progress?: number;
  action: { key: "continue" | "respond" | "pay" | "view"; href: string };
  /** "What happens next", one sentence. */
  next?: string;
  updatedAt: string;
  respondBy?: string;
  unread: number;
}

type Filter = "all" | "you" | "review" | "done";
const FILTERS = ["all", "you", "review", "done"] as const;

/** Which filter an application belongs to: the applicant's turn, the regulator's, or finished. */
function groupOf(item: BoardItem): Exclude<Filter, "all"> {
  const { index, state } = lifecycleOf(item.status, item.lastStep);
  if (state === "done" || state === "refused" || state === "stopped") return "done";
  if (state === "attention" || index <= 2) return "you";
  return "review";
}

/**
 * The applicant's applications as a board (UX-028): filters by whose turn it is, and a card per
 * application with its journey (the current step pulsing), how far a draft is, what happens
 * next, unread updates, and the one action. The whole card opens the application.
 */
export function ApplicationsBoard({ items, locale }: { items: BoardItem[]; locale: string }) {
  const t = useTranslations("applications.board");
  const ta = useTranslations("applications");
  const tm = useTranslations("time");
  const [filter, setFilter] = useState<Filter>("all");
  // The sliding pill: measured from the chosen tab, re-measured when the track resizes.
  const track = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const tab = el.querySelector<HTMLElement>(`[data-filter="${filter}"]`);
      if (tab) setPill({ left: tab.offsetLeft, width: tab.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [filter]);
  function onTabKey(event: React.KeyboardEvent) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = FILTERS[(FILTERS.indexOf(filter) + step + FILTERS.length) % FILTERS.length]!;
    setFilter(next);
    track.current?.querySelector<HTMLElement>(`[data-filter="${next}"]`)?.focus();
  }
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: items.length, you: 0, review: 0, done: 0 };
    for (const item of items) c[groupOf(item)]++;
    return c;
  }, [items]);
  const shown = filter === "all" ? items : items.filter((i) => groupOf(i) === filter);
  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      {/* Whose turn: everything, yours, the regulator's, finished. A pill slides to the chosen
          tab (no shadow); arrow keys move between tabs. */}
      <div
        ref={track}
        role="tablist"
        aria-label={t("filters")}
        onKeyDown={onTabKey}
        className="relative flex w-fit max-w-full [scrollbar-width:none] gap-1 overflow-x-auto rounded-full bg-foreground/[0.04] p-1 dark:bg-surface-2/60"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-full bg-card transition-[transform,width] duration-(--dur-4) ease-(--ease-spring) dark:bg-surface-3"
          style={{
            width: pill.width,
            transform: `translateX(${pill.left}px)`,
            opacity: pill.width ? 1 : 0,
          }}
        />
        {FILTERS.map((key) => {
          const selected = filter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              data-filter={key}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setFilter(key)}
              className={cn(
                "relative z-10 inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-(--dur-2) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filter.${key}`)}
              <span
                key={selected ? `${key}-on` : key}
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.7rem] font-bold num transition-colors duration-(--dur-2)",
                  selected
                    ? "animate-pop bg-primary text-primary-foreground"
                    : "bg-foreground/[0.06] dark:bg-white/[0.08]",
                )}
              >
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[1.75rem] bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]">
          {t(`empty.${filter}`)}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2 @6xl/main:grid-cols-3">
          {shown.map((item, i) => {
            const life = lifecycleOf(item.status, item.lastStep);
            const yours = groupOf(item) === "you";
            return (
              <li
                key={item.id}
                className="animate-rise"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <article
                  className={cn(
                    "glass group relative flex h-full flex-col gap-4 rounded-[1.75rem] p-5 ring-1 ring-primary/[0.08] transition-[transform,box-shadow] duration-(--dur-3) ease-(--ease-standard) hover:-translate-y-0.5 hover:ring-primary/30 dark:ring-white/[0.06] dark:hover:ring-primary/40",
                    yours && "ring-1 ring-primary/20",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* The category as a tile; a dot when there's something unread. */}
                    <span className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,var(--primary-soft),color-mix(in_oklch,var(--primary)_14%,var(--card)))] text-[0.7rem] font-bold text-link">
                      {item.code}
                      {item.unread > 0 && (
                        <span
                          className="absolute -top-1 -right-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground ring-2 ring-card"
                          title={t("unread", { count: item.unread })}
                        >
                          <span className="sr-only">{t("unread", { count: item.unread })}</span>
                          <span aria-hidden>{item.unread}</span>
                        </span>
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h2 className="text-base leading-tight font-semibold">
                        {/* The whole card opens the application. */}
                        <Link
                          href={`/applications/${item.id}` as Route}
                          className="outline-none after:absolute after:inset-0 after:rounded-[1.75rem] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/40"
                        >
                          {item.category}
                        </Link>
                      </h2>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.type} ·{" "}
                        <span className="font-mono whitespace-nowrap">{item.reference}</span>
                      </span>
                    </div>
                    <ApplicationStatusBadge status={item.status} className="max-sm:hidden" />
                  </div>

                  <LifecycleTrack index={life.index} state={life.state} compact />

                  {/* A draft: how far; otherwise what happens next. */}
                  {item.progress !== undefined ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-primary/[0.04] p-3 dark:bg-white/[0.03]">
                      <ProgressRing
                        value={item.progress}
                        total={100}
                        thickness={3.5}
                        className="size-11"
                        label={ta("progress", { percent: item.progress })}
                      >
                        <span className="text-[0.6rem] font-bold num">{item.progress}%</span>
                      </ProgressRing>
                      <span className="text-xs text-muted-foreground">{t("draftHint")}</span>
                    </div>
                  ) : (
                    item.next && <p className="text-sm text-muted-foreground">{item.next}</p>
                  )}
                  {item.respondBy && (
                    <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-destructive">
                      <Clock3 className="size-3.5" aria-hidden />
                      {ta("respondBy", { date: formatDay(item.respondBy, locale) })}
                    </p>
                  )}

                  <div className="relative z-10 mt-auto flex items-center justify-between gap-3 pt-1">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      {item.unread > 0 && <Bell className="size-3.5 text-link" aria-hidden />}
                      {t("updated", {
                        when: relativeLabel(new Date(item.updatedAt), now, tm, (d) =>
                          formatDay(d, locale),
                        ),
                      })}
                    </span>
                    <Button
                      asChild
                      size="sm"
                      variant={item.action.key === "view" ? "outline" : "default"}
                      className="group/btn rounded-full"
                    >
                      <Link href={item.action.href as Route}>
                        {ta(`actions.${item.action.key}`)}
                        <ArrowRight
                          aria-hidden
                          className="transition-transform group-hover/btn:translate-x-0.5"
                        />
                      </Link>
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
          {/* Starting another is one tap away, as the board's last card. */}
          {filter !== "done" && (
            <li>
              <Link
                href={"/applications/new" as Route}
                className="group flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-[1.75rem] border border-dashed border-primary/25 p-5 text-center transition-[background-color,border-color] duration-(--dur-2) hover:border-primary/45 hover:bg-primary-soft/40"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105">
                  <FilePlus2 className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-link">{ta("newButton")}</span>
                <span className="max-w-56 text-xs text-muted-foreground">{t("newHint")}</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
