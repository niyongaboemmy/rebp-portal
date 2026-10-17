"use client";

import { BadgeCheck, Hourglass } from "@/components/icons";
import { useTranslations } from "next-intl";
import type { Category, CategoryPrecheck } from "@rebp/contracts";
import { cn } from "@/lib/utils";

/** An eligibility result as the map needs it (see `result` on CategoryMap). */
export interface MapResult {
  checks: Partial<Record<Category, CategoryPrecheck>>;
  /** The licence they hold today, if any. */
  held: Category | null;
  /** Back to the questions (keeps the answers). */
  onEdit: () => void;
}

/** Where the applicant stands for one category, from their eligibility result. */
export function standingOf(category: Category, result: MapResult) {
  if (result.held === category) return { tone: "held" as const };
  const check = result.checks[category];
  if (!check) return { tone: "missing" as const, missing: [] as string[] };
  if (check.status === "eligible") return { tone: "eligible" as const };
  if (check.status === "notYet" && check.experience)
    return {
      tone: "notYet" as const,
      years: check.experience.required - check.experience.years,
    };
  return { tone: "missing" as const, missing: check.missing as string[] };
}

const STANDING_TONE = {
  held: "bg-primary/10 text-link",
  eligible: "bg-success-soft text-success",
  notYet: "bg-ember-soft text-ember-text",
  missing: "bg-warning-soft text-warning",
} as const;

export function Standing({ category, result }: { category: Category; result: MapResult }) {
  const tm = useTranslations("landing.map");
  const tg = useTranslations("eligibility.guide.need");
  const s = standingOf(category, result);
  const Icon = s.tone === "eligible" || s.tone === "held" ? BadgeCheck : Hourglass;
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium",
        STANDING_TONE[s.tone],
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {s.tone === "held" && tm("standing.held")}
        {s.tone === "eligible" && tm("standing.eligible")}
        {s.tone === "notYet" && tm("standing.notYet", { years: s.years })}
        {s.tone === "missing" &&
          tm("standing.missing", {
            items: s.missing.map((m) => tg(m)).join(", ") || tm("standing.unknown"),
          })}
      </span>
    </p>
  );
}
