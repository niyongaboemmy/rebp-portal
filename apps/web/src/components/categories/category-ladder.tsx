"use client";

import {
  BadgeCheck,
  ChevronRight,
  GraduationCap,
  Hourglass,
  PenLine,
  UserCheck,
  type LucideIcon,
} from "@/components/icons";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CATEGORY_INFO,
  CATEGORY_REQUIREMENTS,
  type Category,
  type CategoryTier,
} from "@rebp/contracts";
import { cn } from "@/lib/utils";

// The requirements dialog loads on the first tap (NFR-PERF-005).
const CategoryDetailDialog = dynamic(() => import("./category-detail"), { ssr: false });

/** Ladder rows, entry → firm (SRS §3.1), read top-down. */
const TIERS: { tier: CategoryTier; categories: Category[] }[] = [
  { tier: "entry", categories: ["RERA", "FSLA"] },
  { tier: "agent", categories: ["REA"] },
  {
    tier: "broker",
    categories: ["BROKER", "ASSOCIATE_BROKER", "MANAGING_BROKER", "PRINCIPAL_BROKER"],
  },
  { tier: "firm", categories: ["REBF"] },
];

/** Tier tint for the section badge: one hue per tier, low-saturation fills (flat, v3). */
const TIER_STYLE: Record<CategoryTier, string> = {
  entry: "bg-chart-3/12 text-foreground",
  agent: "bg-chart-1/12 text-foreground",
  broker: "bg-chart-7/12 text-foreground",
  firm: "bg-chart-4/15 text-foreground",
};

export interface LadderMarker {
  category: Category;
  kind: "current" | "recommended" | "next";
}

/**
 * Interactive category ladder (FR-PORTAL-007): the eight categories as a climb from entry to
 * firm. Tapping a rung opens its requirements as icons in a bottom sheet (dialog on desktop).
 * Optional markers show "You are here", "Recommended" and "Next" (persona Eric).
 */
export function CategoryLadder({
  markers = [],
  className,
}: {
  markers?: LadderMarker[];
  className?: string;
}) {
  const t = useTranslations("ladder");
  const tc = useTranslations("categories");
  const [open, setOpenState] = useState<Category | null>(null);
  const [loaded, setLoaded] = useState(false);
  const setOpen = (category: Category | null) => {
    if (category) setLoaded(true);
    setOpenState(category);
  };
  const markerFor = (c: Category) => markers.find((m) => m.category === c);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {TIERS.map(({ tier, categories }, tierIndex) => (
        <section key={tier} aria-label={tc(`tiers.${tier}`)} className="relative flex gap-3">
          <div className="flex w-6 shrink-0 flex-col items-center" aria-hidden>
            <span
              className={cn(
                "mt-4 size-3 rounded-full ring-4 ring-background",
                tierIndex === TIERS.length - 1 ? "bg-chart-4" : "bg-primary",
              )}
            />
            {tierIndex < TIERS.length - 1 && (
              <span className="mt-1 w-0.5 flex-1 rounded-full bg-gradient-to-b from-primary/60 to-primary/10" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {tc(`tiers.${tier}`)}
            </span>
            <ul className="grid gap-2 sm:grid-cols-2">
              {categories.map((code) => {
                const marker = markerFor(code);
                return (
                  <li key={code}>
                    <button
                      type="button"
                      data-ripple
                      onClick={() => setOpen(code)}
                      aria-haspopup="dialog"
                      className={cn(
                        "group spotlight flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-[background-color,border-color,transform] duration-(--dur-3) ease-spring outline-none hover:bg-primary/[0.03] hover:bg-primary/[0.05] focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.985] active:duration-(--dur-1)",
                        marker?.kind === "current" && "bg-primary/[0.07]",
                        marker?.kind === "recommended" && "bg-sun/15",
                        marker?.kind === "next" && "bg-ember-soft/60",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-2 font-mono text-xs font-bold",
                          TIER_STYLE[tier],
                        )}
                      >
                        {CATEGORY_INFO[code].section}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm leading-tight font-semibold">
                          {tc(`items.${code}.name`)}
                        </span>
                        <RequirementIcons category={code} />
                      </span>
                      {marker ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-bold",
                            marker.kind === "current" && "bg-primary text-primary-foreground",
                            marker.kind === "recommended" && "bg-sun text-sun-foreground",
                            marker.kind === "next" && "bg-ember-soft text-ember-text",
                          )}
                        >
                          {t(`marker.${marker.kind}`)}
                        </span>
                      ) : (
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-(--dur-3) ease-spring group-hover:translate-x-1 group-hover:text-link"
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}

      {loaded && <CategoryDetailDialog category={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Compact icon strip: what the category asks for, at a glance. */
function RequirementIcons({ category }: { category: Category }) {
  const t = useTranslations("ladder.req");
  const r = CATEGORY_REQUIREMENTS[category];
  const items = [
    r.education && { icon: GraduationCap, label: t("education") },
    r.experience && { icon: Hourglass, label: t("experienceShort", { years: r.experience.years }) },
    r.exam && { icon: PenLine, label: t("exam") },
    r.prerequisite && { icon: BadgeCheck, label: t("licenceShort") },
    r.supervised && { icon: UserCheck, label: t("supervised") },
  ].filter(Boolean) as { icon: LucideIcon; label: string }[];
  return (
    <span className="flex flex-wrap gap-1.5 text-muted-foreground">
      {items.map(({ icon: Icon, label }) => (
        <span key={label} className="inline-flex items-center gap-1 text-[0.7rem] font-medium">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </span>
      ))}
    </span>
  );
}
