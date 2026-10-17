"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { RuleResult, StepKey } from "@rebp/contracts";
import { ArrowRight, Calendar, Check, ChevronDown, Flag } from "@/components/icons";
import { formatRuleValues } from "@/components/eligibility/rule-list";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRuleFix } from "./fix-link";
import { actionKey, meterOf, topicOf, verdictKey } from "./issue-visual";

/** "2 years 5 months" style durations, for meters and verdicts. */
function useDuration() {
  const t = useTranslations("wizard.e.coach");
  return (months: number) =>
    t("duration", {
      years: Math.floor(months / 12),
      months: months % 12,
      both: months >= 12 && months % 12 > 0 ? "yes" : "no",
    });
}

/** The verdict in two or three words: "7 months short", "Under 18", "Missing", "Expired". */
export function useVerdict() {
  const t = useTranslations("wizard.issue");
  const duration = useDuration();
  return (rule: RuleResult) => {
    const meter = meterOf(rule);
    if (meter?.kind === "experience" && meter.value < meter.max)
      return t("short", { duration: duration(meter.max - meter.value) });
    if (meter?.kind === "age" && meter.value < meter.max) return t("under", { min: meter.max });
    const key = verdictKey(rule);
    return t.has(`verdict.${key}` as "verdict.fail")
      ? t(`verdict.${key}` as "verdict.fail")
      : t("verdict.fail");
  };
}

/** A number to reach, drawn: what you have, the bar, the gap hatched, the flag at the target. */
export function IssueMeter({ rule }: { rule: RuleResult }) {
  const t = useTranslations("wizard.issue");
  const duration = useDuration();
  const meter = meterOf(rule);
  if (!meter) return null;
  const percent = Math.min(100, Math.round((meter.value / meter.max) * 100));
  const label = (n: number) => (meter.kind === "experience" ? duration(n) : String(n));
  return (
    <div className="flex items-center gap-2.5" role="img" aria-label={t("meter", { percent })}>
      <span className="shrink-0 text-xs font-bold num text-link">{label(meter.value)}</span>
      <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06] dark:bg-surface-3">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-(--dur-4)"
          style={{ width: `${Math.max(percent, percent > 0 ? 4 : 0)}%` }}
        />
        <span
          aria-hidden
          className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--destructive)_25%,transparent)_0_4px,transparent_4px_8px)]"
          style={{ width: `${100 - percent}%` }}
        />
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold num text-muted-foreground">
        <Flag className="size-3.5" aria-hidden />
        {label(meter.max)}
      </span>
    </div>
  );
}

/**
 * One problem, read at a glance (UX-019/020): its picture and topic, the verdict as a pill, a
 * meter when it's a number to reach, and one button named for what to do ("Add experience").
 * The full sentence and advice wait behind "Why?". Only what blocks is red.
 */
export function IssueCard({
  rule,
  current,
  locale,
}: {
  rule: RuleResult;
  current?: StepKey;
  locale: string;
}) {
  const t = useTranslations("wizard.issue");
  const tr = useTranslations("rules");
  const fix = useRuleFix(rule, current);
  const verdict = useVerdict();
  const [open, setOpen] = useState(false);
  const why = useId();
  const { icon: Icon, key } = topicOf(rule);
  const failing = rule.outcome === "FAIL";
  const values = formatRuleValues(rule.values, locale);
  const message = tr.has(rule.message as "BR-001.pass")
    ? tr(rule.message as "BR-001.pass", values)
    : rule.message;
  const how =
    rule.fix && tr.has(rule.fix as "BR-001.pass") ? tr(rule.fix as "BR-001.pass", values) : null;

  return (
    <li
      className={cn(
        "flex animate-rise flex-col gap-2.5 rounded-2xl bg-card p-3.5 shadow-[0_1px_2px_oklch(0.3_0.08_264/0.05),0_12px_30px_-22px_oklch(0.35_0.15_264/0.45)] ring-1 dark:bg-surface-2/70",
        failing ? "ring-destructive/20" : "ring-primary/15",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* What it's about, flagged. */}
        <span
          aria-hidden
          className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,var(--primary-soft),color-mix(in_oklch,var(--primary)_14%,var(--card)))] text-link"
        >
          <Icon className="size-[1.35rem]" />
          <span
            className={cn(
              "absolute -top-1 -right-1 inline-flex size-[1.15rem] items-center justify-center rounded-full text-[0.65rem] font-bold text-white ring-2 ring-card",
              failing ? "bg-destructive" : "bg-primary",
            )}
          >
            {failing ? "!" : "i"}
          </span>
        </span>

        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">
              <span className="sr-only">{tr(`outcome.${rule.outcome}`)}: </span>
              {t(`topics.${key}`)}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold",
                failing
                  ? "bg-danger-soft text-destructive"
                  : "bg-primary-soft text-primary-soft-foreground",
              )}
            >
              {verdict(rule)}
            </span>
          </div>
          <IssueMeter rule={rule} />
        </div>

        {fix && (
          <Button
            type="button"
            size="sm"
            onClick={fix.run}
            className="group w-full shrink-0 rounded-full @lg/form:w-auto"
          >
            {t(`do.${actionKey(rule)}` as "do.fix")}
            <ArrowRight aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </Button>
        )}
      </div>

      {/* When, and the full explanation on demand. */}
      <div className="flex flex-wrap items-center gap-2 text-xs @lg/form:pl-14">
        {rule.eligibleFrom && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary-soft-foreground">
            <Calendar className="size-3.5" aria-hidden />
            {t("eligibleOn", { date: formatDay(rule.eligibleFrom, locale) })}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={why}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
        >
          {t("why")}
          <ChevronDown
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>
      {open && (
        <p
          id={why}
          className="animate-rise text-sm leading-relaxed text-muted-foreground [animation-duration:var(--dur-2)] @lg/form:pl-14"
        >
          <span className="text-foreground">{message}</span> {how}
        </p>
      )}
    </li>
  );
}

/**
 * The same problem under the answer it's about (UX-020): no topic (the field says it), just the
 * verdict, a meter if there's a number to reach, "Why?" for the sentence, and — when the fix is
 * somewhere else — its button.
 */
export function IssueLine({
  rule,
  locale,
  action,
}: {
  rule: RuleResult;
  locale: string;
  action?: React.ReactNode;
}) {
  const t = useTranslations("wizard.issue");
  const tr = useTranslations("rules");
  const verdict = useVerdict();
  const [open, setOpen] = useState(false);
  const why = useId();
  const { icon: Icon } = topicOf(rule);
  const failing = rule.outcome === "FAIL";
  const values = formatRuleValues(rule.values, locale);
  const message = tr.has(rule.message as "BR-001.pass")
    ? tr(rule.message as "BR-001.pass", values)
    : rule.message;
  const how =
    rule.fix && tr.has(rule.fix as "BR-001.pass") ? tr(rule.fix as "BR-001.pass", values) : null;
  return (
    <div className="flex animate-rise flex-col gap-1.5 [animation-duration:var(--dur-3)]">
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-lg",
            failing ? "bg-danger-soft text-destructive" : "bg-primary-soft text-link",
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold",
            failing
              ? "bg-danger-soft text-destructive"
              : "bg-primary-soft text-primary-soft-foreground",
          )}
        >
          <span className="sr-only">{tr(`outcome.${rule.outcome}`)}: </span>
          {verdict(rule)}
        </span>
        {rule.eligibleFrom && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden />
            {formatDay(rule.eligibleFrom, locale)}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={why}
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {t("why")}
          <ChevronDown
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {action}
      </div>
      <IssueMeter rule={rule} />
      {open && (
        <p id={why} className="text-sm leading-relaxed text-muted-foreground">
          <span className="text-foreground">{message}</span> {how}
        </p>
      )}
    </div>
  );
}

/**
 * A requirement that's met, as a small tile (UX-023): its picture, its topic and a tick; the
 * sentence is the tile's tooltip. Grids of these show at a glance what's already settled.
 */
export function MetTile({ rule, locale }: { rule: RuleResult; locale: string }) {
  const t = useTranslations("wizard.issue");
  const tr = useTranslations("rules");
  const { icon: Icon, key } = topicOf(rule);
  const message = tr.has(rule.message as "BR-001.pass")
    ? tr(rule.message as "BR-001.pass", formatRuleValues(rule.values, locale))
    : rule.message;
  return (
    <li
      title={message}
      className="flex items-center gap-2.5 rounded-2xl bg-card p-2.5 ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]"
    >
      <span
        aria-hidden
        className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link"
      >
        <Icon className="size-[1.1rem]" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">{t(`topics.${key}`)}</span>
        <span className="truncate text-xs text-muted-foreground">
          <span className="sr-only">{message} </span>
          <span aria-hidden className="inline-flex items-center gap-1 text-link">
            <Check className="size-3.5" strokeWidth={2.25} />
            {t("met")}
          </span>
        </span>
      </span>
    </li>
  );
}
