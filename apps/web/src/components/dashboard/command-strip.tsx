"use client";

import type { Route } from "next";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Donut } from "./donut";
import { LiveRefresh } from "./live-refresh";

export interface WaitingSlice {
  key: "overdue" | "queue" | "decisions" | "register" | "configuration";
  count: number;
  /** Where to act on it (absent when that console is not the viewer's). */
  href?: Route;
}

/** Blue-led (ADR-009 v17): work in hand in primary tints, awaiting in yellow, overdue red. */
const COLOR: Record<WaitingSlice["key"], string> = {
  overdue: "var(--destructive)",
  queue: "var(--primary)",
  // Awaiting a decision reads yellow (ADR-009 v17).
  decisions: "var(--sun)",
  register: "color-mix(in oklch, var(--primary) 45%, var(--card))",
  configuration: "color-mix(in oklch, var(--primary) 28%, var(--card))",
};

/**
 * The command strip (UX-040): who, when, how much is waiting — as one number and a ring split by
 * where it waits — and the single next action. Words are cut to the minimum; the ring explains.
 */
export function CommandStrip({
  title,
  firstName,
  roles,
  waiting,
  focus,
}: {
  /** The page heading ("Back office"). */
  title: string;
  firstName: string;
  roles: string;
  waiting: WaitingSlice[];
  focus: { title: string; cta: string; href: Route; danger: boolean } | null;
}) {
  const t = useTranslations("boDash.command");
  const format = useFormatter();
  const total = waiting.reduce((s, w) => s + w.count, 0);
  return (
    <section
      aria-labelledby="bo-title"
      data-tone={focus?.danger ? "danger" : undefined}
      className="hero-surface relative flex animate-rise flex-col gap-5 overflow-hidden rounded-[1.75rem] p-5 sm:p-6 @3xl/main:flex-row @3xl/main:items-center"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[0.6875rem] font-bold tracking-widest text-link uppercase">
              {t("hello", { name: firstName })} ·{" "}
              {format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <h1 id="bo-title" className="text-2xl @3xl/main:text-3xl">
              {title}
            </h1>
            <span className="text-xs text-muted-foreground">{roles}</span>
          </div>
          <LiveRefresh />
        </div>
        {focus ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-card/80 p-3 ring-1 ring-foreground/[0.05] @xl/main:flex-row @xl/main:items-center dark:bg-white/[0.04] dark:ring-white/[0.06]">
            <span
              className={cn(
                "inline-flex h-7 w-fit items-center rounded-full px-2.5 text-[0.6875rem] font-bold tracking-wider uppercase",
                focus.danger ? "bg-danger-soft text-destructive" : "bg-sun text-sun-foreground",
              )}
            >
              {t("next")}
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold">{focus.title}</span>
            <Button asChild className="group shrink-0 rounded-full">
              <Link href={focus.href}>
                {focus.cta}
                <ArrowRight
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
          </div>
        ) : (
          <p className="w-fit rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary-soft-foreground">
            {t("clear")}
          </p>
        )}
      </div>
      <Donut
        className="@3xl/main:w-80"
        size={132}
        thickness={10}
        label={t("waiting")}
        segments={waiting
          .filter((w) => w.count > 0)
          .map((w) => ({
            key: w.key,
            label: t(`slice.${w.key}`),
            value: w.count,
            color: COLOR[w.key],
            href: w.href,
            action: t(`act.${w.key}`, { count: w.count }),
          }))}
        hint={total > 0 ? t("hint") : undefined}
        center={
          <>
            <span className="text-3xl font-bold num">{total}</span>
            <span className="text-[0.65rem] text-muted-foreground">{t("waiting")}</span>
          </>
        }
      />
    </section>
  );
}
