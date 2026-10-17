"use client";

import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Cake,
  ClipboardCheck,
  GraduationCap,
  Hourglass,
  MapPin,
  PenLine,
  Check,
  UserCheck,
  Users,
} from "@/components/icons";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CATEGORY_INFO,
  CATEGORY_REQUIREMENTS,
  PRECHECK_DOCUMENTS,
  type Category,
} from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Standing, standingOf, type MapResult } from "./standing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Requirements sheet for one category, loaded on the first tap of "Requirements". Exploring, it
 * lists what the category needs and offers to check eligibility for it (or find licensed people
 * in it). With an eligibility result, each requirement is ticked or flagged for this applicant
 * and the button is the matching next step: apply, or update the answers.
 */
export default function CategoryDetailDialog({
  category,
  result,
  onClose,
}: {
  category: Category | null;
  result?: MapResult;
  onClose: () => void;
}) {
  return (
    <Dialog open={category !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        {category && <CategoryDetail category={category} result={result} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

/** Which precheck gap a requirement row corresponds to. */
type Gap = "adult" | "education" | "experience" | "brokerLicence" | "firm" | null;

function CategoryDetail({
  category,
  result,
  onClose,
}: {
  category: Category;
  result?: MapResult;
  onClose: () => void;
}) {
  const tm = useTranslations("landing.map");
  const t = useTranslations("ladder");
  const tc = useTranslations("categories");
  const td = useTranslations("eligibility.documents");
  const r = CATEGORY_REQUIREMENTS[category];
  const isFirm = category === "REBF";
  const rows = [
    r.adult && { icon: Cake, title: t("req.adult"), gap: "adult" },
    r.education && {
      icon: GraduationCap,
      title: t(`education.${r.education}`),
      gap: "education",
    },
    r.training && { icon: ClipboardCheck, title: t("req.training"), gap: null },
    r.exam && { icon: PenLine, title: t("req.examFull"), gap: null },
    r.experience && {
      gap: "experience",
      icon: Hourglass,
      title: t("req.experience", {
        years: r.experience.years,
        category: CATEGORY_INFO[r.experience.as].abbreviation,
      }),
    },
    r.prerequisite && {
      gap: "brokerLicence",
      icon: BadgeCheck,
      title: t("req.licence", { category: tc(`items.${r.prerequisite}.name`) }),
    },
    r.supervised && { icon: UserCheck, title: t("req.supervisedFull"), gap: null },
    isFirm && { icon: Building2, title: t("req.firm"), gap: "firm" },
    category === "FSLA" && { icon: MapPin, title: t("req.territory"), gap: null },
  ].filter(Boolean) as { icon: typeof Cake; title: string; gap: Gap }[];
  const check = result?.checks[category];
  const standing = result ? standingOf(category, result) : null;
  /** Met (true), not met (false) or not something the quick check asks about (undefined). */
  const met = (gap: Gap) =>
    !check || gap === null ? undefined : !(check.missing as string[]).includes(gap);
  const abbr = CATEGORY_INFO[category].abbreviation;

  return (
    <>
      <DialogHeader>
        <span className="font-mono text-xs font-bold text-link">
          {CATEGORY_INFO[category].section} · {CATEGORY_INFO[category].abbreviation}
        </span>
        <DialogTitle>{tc(`items.${category}.name`)}</DialogTitle>
        <DialogDescription>{tc(`items.${category}.summary`)}</DialogDescription>
      </DialogHeader>
      {result && <Standing category={category} result={result} />}
      <ul className="flex flex-col gap-2">
        {rows.map(({ icon: Icon, title, gap }, i) => {
          const ok = met(gap);
          return (
            <li
              key={title}
              className={cn(
                "flex animate-rise items-center gap-3 rounded-xl p-3 text-sm font-medium",
                ok === false ? "bg-warning-soft/70" : "bg-surface-2 dark:bg-white/[0.04]",
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-[1.1rem]" aria-hidden />
              </span>
              <span className="flex-1">{title}</span>
              {ok !== undefined && (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    ok
                      ? "bg-success-soft text-success"
                      : "bg-card text-warning dark:bg-white/[0.08]",
                  )}
                >
                  {ok ? <Check className="size-3.5" aria-hidden /> : null}
                  {ok ? tm("met") : tm("notMet")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {t("prepare")}
        </span>
        <ul className="flex flex-wrap gap-1.5">
          {PRECHECK_DOCUMENTS[category].map((doc) => (
            <li key={doc} className="rounded-full border px-2.5 py-1 text-xs font-medium">
              {td(doc)}
            </li>
          ))}
        </ul>
      </div>
      {/* The next step, from where the applicant stands (or an invitation to check). */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {!result ? (
          <Button asChild size="lg" className="sm:flex-1">
            <Link href={`/eligibility?for=${category}`}>
              {tm("checkFor", { category: abbr })} <ArrowRight />
            </Link>
          </Button>
        ) : standing?.tone === "eligible" ? (
          <Button asChild size="lg" className="sm:flex-1">
            <Link href="/sign-up">
              {tm("applyAs", { category: abbr })} <ArrowRight />
            </Link>
          </Button>
        ) : standing?.tone !== "held" ? (
          <Button
            size="lg"
            className="sm:flex-1"
            onClick={() => {
              onClose();
              result.onEdit();
            }}
          >
            {tm("updateAnswers")} <PenLine />
          </Button>
        ) : null}
        <Button asChild size="lg" variant="outline">
          <Link href={`/register?view=list&category=${category}`}>
            <Users /> {tm("findLicensed")}
          </Link>
        </Button>
      </div>
    </>
  );
}
