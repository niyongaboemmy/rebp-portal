"use client";

import { useTranslations } from "next-intl";
import type { RuleOutcome, RuleResult } from "@rebp/contracts";
import { formatRuleValues } from "@/components/eligibility/rule-list";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LIST_GROUP, LIST_ROW, Mark, type MarkState } from "./marks";

const ORDER: Record<RuleOutcome, number> = { FAIL: 0, NEEDS_ASSESSMENT: 1, WARN: 2, PASS: 3 };
const MARKS: Record<RuleOutcome, MarkState> = {
  PASS: "done",
  WARN: "todo",
  NEEDS_ASSESSMENT: "todo",
  FAIL: "failed",
};

/**
 * Eligibility engine results for officers and approvers (FR-L-004, FR-M-001): one calm row per
 * rule — a soft tick when it passes, a Sun dot when it needs a look, red only when it fails —
 * with the BR identifier for traceability. Blocking results come first.
 */
export function RuleRows({
  rules,
  locale,
  showPasses = true,
  className,
}: {
  rules: readonly RuleResult[];
  locale: string;
  showPasses?: boolean;
  className?: string;
}) {
  const t = useTranslations("rules");
  const tw = useTranslations("wizard.eligibility");
  const visible = [...rules]
    .filter((r) => showPasses || r.outcome !== "PASS")
    .sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome]);
  if (visible.length === 0) return null;
  return (
    <ul className={cn(LIST_GROUP, className)}>
      {visible.map((rule) => {
        const key = rule.message as "BR-001.pass";
        return (
          <li key={`${rule.id}-${rule.message}`} className={cn("flex items-start gap-3", LIST_ROW)}>
            <Mark state={MARKS[rule.outcome]} className="mt-px" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm leading-snug">
                <span className="sr-only">{t(`outcome.${rule.outcome}`)}: </span>
                {t.has(key) ? t(key, formatRuleValues(rule.values, locale)) : rule.message}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                <span className="font-mono">{rule.id}</span>
                {rule.eligibleFrom &&
                  ` · ${tw("eligibleFrom", { date: formatDay(rule.eligibleFrom, locale) })}`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
