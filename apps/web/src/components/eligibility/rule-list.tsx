"use client";

import { useTranslations } from "next-intl";
import {
  CATEGORY_INFO,
  type Category,
  type RuleOutcome,
  type RuleResult,
  type StatusTone,
} from "@rebp/contracts";
import { TONE_BORDER, TONE_ICONS, TONE_SOFT_BG, TONE_TEXT } from "@/components/data/tones";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export const OUTCOME_TONES: Record<RuleOutcome, StatusTone> = {
  PASS: "good",
  WARN: "warning",
  NEEDS_ASSESSMENT: "info",
  FAIL: "critical",
};

/**
 * Rule values as the applicant reads them: ISO days as dates, category codes as their
 * abbreviations ("BRK, MBR or PBR"). Everything else passes through.
 */
export function formatRuleValues(
  values: RuleResult["values"],
  locale: string,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const abbreviation = (code: string) => CATEGORY_INFO[code as Category]?.abbreviation ?? code;
  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
      out[key] = formatDay(value, locale);
    else if (key === "held") out[key] = abbreviation(String(value));
    else if (key === "allowed")
      out[key] = new Intl.ListFormat(locale, { type: "disjunction" }).format(
        String(value).split(",").map(abbreviation),
      );
    else out[key] = value;
  }
  return out;
}

const ORDER: Record<RuleOutcome, number> = { FAIL: 0, NEEDS_ASSESSMENT: 1, WARN: 2, PASS: 3 };

/**
 * Eligibility engine results (FR-ELG-001, FR-WIZ-007, FR-L-004): one row per rule with tone icon,
 * the plain-language message and, for time-based rules, the eligible-from date (FR-ELG-004).
 * Blocking results come first.
 */
export function RuleList({
  rules,
  locale = "en",
  showPasses = true,
  showIds = false,
  guided = false,
  action,
  className,
}: {
  rules: readonly RuleResult[];
  locale?: string;
  showPasses?: boolean;
  /** Officers see the BR identifier (traceability). */
  showIds?: boolean;
  /** Applicants see how to fix each problem under it (UX-004); officers don't need it. */
  guided?: boolean;
  /** Optional shortcut per rule (e.g. "Fix in Education →"); shown on rules that need work. */
  action?: (rule: RuleResult) => React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("rules");
  const tw = useTranslations("wizard.eligibility");
  const visible = [...rules]
    .filter((r) => showPasses || r.outcome !== "PASS")
    .sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome]);
  if (visible.length === 0) return null;
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {visible.map((rule) => {
        const tone = OUTCOME_TONES[rule.outcome];
        const Icon = TONE_ICONS[tone];
        const key = rule.message as "BR-001.pass";
        return (
          <li
            key={`${rule.id}-${rule.message}`}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1.5",
              // Applicants: a calm accent rule (UX-005); officers: the tinted rows they scan.
              guided
                ? cn("border-l-2 py-0.5 pl-3", TONE_BORDER[tone])
                : cn("rounded-xl px-3.5 py-2.5", TONE_SOFT_BG[tone]),
            )}
          >
            <Icon className={cn("size-4 shrink-0", TONE_TEXT[tone])} aria-hidden />
            <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
              <span className="text-sm leading-snug">
                <span className="sr-only">{t(`outcome.${rule.outcome}`)}: </span>
                {t.has(key) ? t(key, formatRuleValues(rule.values, locale)) : rule.message}
              </span>
              {guided && rule.fix && t.has(rule.fix as "BR-001.pass") && (
                <span className="text-sm leading-snug text-muted-foreground">
                  {t(rule.fix as "BR-001.pass", formatRuleValues(rule.values, locale))}
                </span>
              )}
              {(rule.eligibleFrom || showIds) && (
                <span className="text-xs font-medium text-muted-foreground">
                  {showIds && <span className="font-mono">{rule.id}</span>}
                  {showIds && rule.eligibleFrom && " · "}
                  {rule.eligibleFrom &&
                    tw("eligibleFrom", { date: formatDay(rule.eligibleFrom, locale) })}
                </span>
              )}
            </div>
            {/* The shortcut sits on the same line (wraps below on narrow screens). */}
            {action && (rule.outcome === "FAIL" || rule.outcome === "WARN") && (
              <span className="ml-7 shrink-0 sm:ml-auto">{action(rule)}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
