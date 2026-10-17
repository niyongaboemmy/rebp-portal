"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { RULE_FIELDS, type SectionKey, type StepKey } from "@rebp/contracts";
import { ArrowRight, Check, ChevronDown } from "@/components/icons";
import { OUTCOME_TONES } from "@/components/eligibility/rule-list";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/info-tip";
import { StatusBadge } from "@/components/ui/status-badge";
import type { RuleOutcome } from "@rebp/contracts";
import { cn } from "@/lib/utils";
import { getPath, useWizard } from "./context";
import { FixLink } from "./fix-link";
import { IssueCard, IssueLine } from "./issue-card";
import { rulesOnStep, type Journey } from "./state";

/**
 * Where eligibility speaks (UX-004 Phase 2, UX-003 §6): a rule about one answer appears under that
 * answer; the step's other rules sit in one quiet list above the form; everything elsewhere in
 * the application is a count in the rail. Each rule appears in exactly one place.
 */

interface RuleSlots {
  /** Fields ("f.supervisorLicenceNo") that render their own rules on the current step. */
  bound: ReadonlySet<string>;
  register: (field: string) => () => void;
}

const RuleSlotsContext = createContext<RuleSlots | null>(null);

export function RuleSlotsProvider({ children }: { children: React.ReactNode }) {
  const [bound, setBound] = useState<ReadonlySet<string>>(new Set());
  const register = useCallback((field: string) => {
    setBound((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
    return () =>
      setBound((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
  }, []);
  return (
    <RuleSlotsContext.Provider value={{ bound, register }}>{children}</RuleSlotsContext.Provider>
  );
}

const RULE_BEARING = new Set(Object.values(RULE_FIELDS));

/**
 * Claims a field's rule slot for a component that shows the rule its own way (e.g. the licence
 * card), so the step's issue list doesn't repeat it. `null` claims nothing.
 */
export function useRuleSlot(field: string | null) {
  const register = useContext(RuleSlotsContext)?.register;
  useLayoutEffect(() => (field && register ? register(field) : undefined), [register, field]);
}

/**
 * The rules about one answer, shown under it. Between a change and the next autosave the old
 * result may be stale, so it shows "Checking…" instead. A problem that goes away is
 * acknowledged with a brief tick, then the row disappears.
 */
export function FieldRule({ section, path }: { section: SectionKey; path: string }) {
  const t = useTranslations("wizard.journey");
  const { eligibility, data, locale } = useWizard();
  const slots = useContext(RuleSlotsContext);
  const field = `${section}.${path}`;
  const register = slots?.register;

  useLayoutEffect(() => register?.(field), [register, field]);

  // The answer as it was when eligibility last ran; a different answer means "not checked yet".
  const value = JSON.stringify(getPath(data[section], path) ?? null);
  const [checked, setChecked] = useState({ eligibility, value });
  if (checked.eligibility !== eligibility) setChecked({ eligibility, value });
  const pending = RULE_BEARING.has(field) && value !== checked.value && value !== "null";

  const rules = eligibility.rules.filter((r) => r.field === field && r.outcome !== "PASS");
  const failing = rules.some((r) => r.outcome === "FAIL");

  // "Sorted": the answer failed before this run and passes now.
  const [wasFailing, setWasFailing] = useState(failing);
  const [resolved, setResolved] = useState(false);
  if (!pending && wasFailing !== failing) {
    setWasFailing(failing);
    if (!failing) setResolved(true);
  }
  useEffect(() => {
    if (!resolved) return;
    const id = setTimeout(() => setResolved(false), 1600);
    return () => clearTimeout(id);
  }, [resolved]);

  if (pending)
    return (
      // Checking: a message-shaped placeholder where the result will appear (UX-009).
      <div
        role="status"
        className="flex items-start gap-2.5 border-l-2 border-foreground/10 py-0.5 pl-3"
        data-rule-field={field}
      >
        <span className="sr-only">{t("checking")}</span>
        <Skeleton className="mt-0.5 size-4 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5" aria-hidden>
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  if (resolved && rules.length === 0)
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-link" aria-live="polite">
        <Check className="size-3.5 animate-pop" aria-hidden /> {t("resolved")}
      </p>
    );
  if (rules.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" aria-live="polite" data-rule-field={field}>
      {/* A verdict, a meter, "Why?" — not a paragraph (UX-020). */}
      {rules.map((rule) => (
        <IssueLine
          key={rule.message}
          rule={rule}
          locale={locale}
          // On the field itself, only a document replacement is somewhere else to go.
          action={
            rule.action?.kind === "replaceDocument" ? (
              <FixLink rule={rule} current={section} />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

/** A field's rule slot; renders only for answers a rule is about. */
export function FieldRules({ section, path }: { section: SectionKey; path: string }) {
  return RULE_BEARING.has(`${section}.${path}`) ? (
    <FieldRule section={section} path={path} />
  ) : null;
}

/**
 * This step's rules that no visible answer shows (e.g. about a list of qualifications), in one
 * neutral block above the form. Nothing at all when the step is clean.
 */
export function StepIssues({ step }: { step: StepKey }) {
  const { eligibility, locale } = useWizard();
  const slots = useContext(RuleSlotsContext);
  const rules = rulesOnStep(eligibility.rules, step)
    .filter((rule) => rule.outcome !== "PASS" && (!rule.field || !slots?.bound.has(rule.field)))
    // What blocks first.
    .sort((a, b) => (a.outcome === "FAIL" ? -1 : b.outcome === "FAIL" ? 1 : 0));
  if (rules.length === 0) return null;
  return (
    // One card per problem: what it's about, how far, where and what to do, and "Fix now" (UX-019).
    <section data-issues className="flex scroll-mt-28 flex-col">
      <ul className="flex flex-col gap-2.5">
        {rules.map((rule) => (
          <IssueCard
            key={`${rule.id}-${rule.message}`}
            rule={rule}
            current={step}
            locale={locale}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * The application as a whole, in the rail (desktop) or under the progress bar (phones): the
 * indicative outcome and "2 to fix · 1 officer check", opening to the list with a way to each.
 */
export function JourneyStatus({
  journey,
  step,
  compact = false,
}: {
  journey: Journey;
  step: StepKey;
  compact?: boolean;
}) {
  const t = useTranslations("wizard.journey");
  const tr = useTranslations("rules.outcome");
  const te = useTranslations("wizard.eligibility");
  const { eligibility, locale } = useWizard();
  const [open, setOpen] = useState(false);
  const listed = [...journey.toFix, ...journey.notes, ...journey.officer];
  const parts = [
    journey.toFix.length > 0 && t("toFix", { count: journey.toFix.length }),
    journey.notes.length > 0 && t("notes", { count: journey.notes.length }),
    journey.officer.length > 0 && t("officer", { count: journey.officer.length }),
  ].filter(Boolean);
  if (eligibility.rules.length === 0) return null;
  // From what the applicant has reached: a rule on a step not reached yet doesn't count.
  const outcome =
    journey.toFix.length > 0
      ? "FAIL"
      : journey.officer.length > 0
        ? "NEEDS_ASSESSMENT"
        : journey.notes.length > 0
          ? "WARN"
          : "PASS";

  // Phones: one row, the verdict and the count; the list opens below.
  if (compact)
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <OutcomeChip outcome={outcome} label={tr(outcome)} />
          {listed.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {parts.join(" · ")}
              <ChevronDown
                className={cn("size-4 transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>
          )}
        </div>
        {open && (
          <ul className="flex animate-rise flex-col gap-2 [animation-duration:var(--dur-3)]">
            {listed.map((rule) => (
              <IssueCard
                key={`${rule.id}-${rule.message}`}
                rule={rule}
                current={step}
                locale={locale}
              />
            ))}
          </ul>
        )}
      </div>
    );

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        !compact && "border-b border-foreground/[0.06] p-4 dark:border-white/[0.06]",
      )}
    >
      {/* Wraps in a narrow rail: the verdict drops under the title rather than overflowing. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span className="inline-flex items-center gap-1 text-sm font-semibold">
          {t("title")}
          <InfoTip>{te("disclaimer")}</InfoTip>
        </span>
        <OutcomeChip outcome={outcome} label={tr(outcome)} />
      </div>
      {listed.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-8 items-center justify-between gap-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                journey.toFix.length > 0 ? "bg-destructive" : "bg-primary/60",
              )}
            />
            {parts.join(" · ")}
          </span>
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      ) : (
        <p className="flex items-center gap-1.5 text-xs font-medium text-link">
          <Check className="size-3.5" aria-hidden /> {t("allClear")}
        </p>
      )}
      {open && (
        <ul className="flex animate-rise flex-col gap-2 [animation-duration:var(--dur-3)]">
          {listed.map((rule) => (
            <IssueCard
              key={`${rule.id}-${rule.message}`}
              rule={rule}
              current={step}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The step's state as one chip: "3 answers left", "1 to fix", "Officer check" or "Done". */
export function StepBadge({
  left,
  failing,
  officer,
  onGo,
}: {
  left: number;
  failing: number;
  officer: number;
  /** Takes the applicant to the first problem (UX-023); the badge becomes a button. */
  onGo?: () => void;
}) {
  const t = useTranslations("wizard");
  const kind = failing > 0 ? "fix" : left > 0 ? "left" : officer > 0 ? "officer" : "done";
  const Tag = onGo && (kind === "fix" || kind === "left") ? "button" : "span";
  return (
    <Tag
      aria-live="polite"
      data-step-badge={kind}
      {...(Tag === "button" ? { type: "button" as const, onClick: onGo } : {})}
      className={cn(
        "group/badge inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
        Tag === "button" &&
          "hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        kind === "fix" && "bg-danger-soft text-destructive",
        kind === "left" && "bg-foreground/[0.05] text-muted-foreground dark:bg-surface-2",
        kind === "officer" && "bg-primary-soft text-link",
        kind === "done" && "bg-primary-soft text-link",
      )}
    >
      {kind === "done" ? (
        <Check className="size-3.5 animate-pop" aria-hidden />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            kind === "fix" ? "bg-destructive" : kind === "officer" ? "bg-primary/60" : "bg-primary",
          )}
        />
      )}
      {kind === "fix"
        ? t("toFix", { count: failing })
        : kind === "left"
          ? t("errors.left", { count: left })
          : kind === "officer"
            ? t("journey.officerStep")
            : t("journey.done")}
      {Tag === "button" && (
        <ArrowRight
          className="size-3.5 transition-transform group-hover/badge:translate-x-0.5"
          aria-hidden
        />
      )}
    </Tag>
  );
}

/**
 * The application's indicative outcome. Eligible reads in the primary colour (UX-007: primary,
 * not green, carries "all good" in this flow); red and amber stay for what needs attention.
 */
function OutcomeChip({ outcome, label }: { outcome: RuleOutcome; label: string }) {
  if (outcome !== "PASS") return <StatusBadge tone={OUTCOME_TONES[outcome]} label={label} />;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-soft-foreground">
      <Check className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
