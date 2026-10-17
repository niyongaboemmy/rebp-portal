"use client";

import { useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CATEGORIES,
  CATEGORY_INFO,
  CATEGORY_REQUIREMENTS,
  type ApplicationType,
  type Category,
  type FeeSchedule,
  type LicenseStatus,
  type TypeUnavailableReason,
  isCvSection,
  sectionsFor,
  type CvSection,
} from "@rebp/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Building2,
  Check,
  FilePlus2,
  Lock,
  RefreshCw,
  TriangleAlert,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useErrorMessage } from "@/hooks/use-error-message";
import { formatDay, formatMoney } from "@/lib/format";
import { HOVER, INTERACTIVE, SELECTED, SURFACE, SURFACE_MUTED } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { createApplicationAction } from "@/server/actions/applications";
import { BeforeYouStart } from "./before-you-start";

type Screen = "type" | "category" | "review";
const SCREENS: Screen[] = ["type", "category", "review"];

export type AvailabilityMap = Record<
  ApplicationType,
  Record<Category, TypeUnavailableReason | null>
>;

interface HeldLicence {
  id: string;
  licenceNo: string;
  category: Category;
  status: LicenseStatus;
  expiresAt: string;
  renewable: boolean;
}

const TYPE_ICONS: Partial<Record<ApplicationType, typeof FilePlus2>> = {
  NEW: FilePlus2,
  UPGRADE: Award,
  RENEWAL: RefreshCw,
  FIRM_REGISTRATION: Building2,
};

/**
 * Section A chooser (FR-A-003…007, FR-DOM-001). Types the account can never use are hidden; every
 * other option is shown, and an unavailable one explains why instead of disappearing.
 */
export function NewApplication({
  availability,
  pilotTypes,
  fees,
  schedule,
  sampleFees,
  accountType,
  locale,
  licences,
  initialType,
  initialCategory,
  initialLicence,
  cvReady = null,
}: {
  availability: AvailabilityMap;
  pilotTypes: ApplicationType[];
  fees: Record<Category, number>;
  /** The fee schedule, for the line-by-line quote before starting. */
  schedule: FeeSchedule;
  sampleFees: boolean;
  accountType: "INDIVIDUAL" | "ORGANISATION";
  locale: string;
  licences: HeldLicence[];
  initialType?: ApplicationType;
  initialCategory?: Category;
  initialLicence?: string;
  /** Which CV parts are ready; null when the account keeps no CV (UX-021). */
  cvReady?: Record<CvSection, boolean> | null;
}) {
  const t = useTranslations("applications.new");
  const tc = useTranslations("categories.items");
  const tt = useTranslations("applicationTypes");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const types = pilotTypes.filter((type) =>
    accountType === "ORGANISATION"
      ? type === "FIRM_REGISTRATION" || type === "RENEWAL"
      : type !== "FIRM_REGISTRATION",
  );
  const [type, setType] = useState<ApplicationType>(
    initialType && types.includes(initialType) ? initialType : types[0]!,
  );
  const preselected = initialLicence ? licences.find((l) => l.id === initialLicence) : undefined;
  const [category, setCategory] = useState<Category | undefined>(
    preselected?.category ??
      (initialCategory && !availability[type][initialCategory]
        ? initialCategory
        : type === "FIRM_REGISTRATION"
          ? "REBF"
          : undefined),
  );
  const [licenceId, setLicenceId] = useState<string | undefined>(preselected?.id);
  // Survey format (UX-006): one question per screen. A link that already names the category
  // (from the eligibility check or a licence card) opens straight at the review.
  const [screen, setScreen] = useState<Screen>(() =>
    category ? "review" : types.length === 1 ? "category" : "type",
  );
  const [existing, setExisting] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categories = CATEGORIES.filter((c) =>
    accountType === "ORGANISATION" ? c === "REBF" : c !== "REBF" || type === "RENEWAL",
  );
  const renewable = licences.filter((l) => l.renewable && l.category === category);

  const chooseType = (next: ApplicationType) => {
    setType(next);
    setScreen(next === "FIRM_REGISTRATION" ? "review" : "category");
    setExisting(null);
    setLicenceId(undefined);
    setCategory(
      next === "FIRM_REGISTRATION"
        ? "REBF"
        : category && !availability[next][category]
          ? category
          : undefined,
    );
  };

  const start = () =>
    startTransition(async () => {
      if (!category) return;
      const result = await createApplicationAction({
        type,
        category,
        relatedLicenceId: type === "RENEWAL" ? (licenceId ?? renewable[0]?.id) : undefined,
      });
      if (!result.ok) {
        if (result.error === "errors.applicationExists" && typeof result.meta?.id === "string")
          setExisting(result.meta.id);
        toast.error(errorMessage(result.error, result.meta));
        return;
      }
      router.push(`/applications/${result.data.id}/wizard` as Route);
    });

  const at = SCREENS.indexOf(screen);
  const canBack = at > 0 && (types.length > 1 || at > 1);
  // Continue when the screen already has an answer (e.g. after coming back with Back).
  const canProceed = screen === "type" ? true : Boolean(category && !availability[type][category]);
  const proceed = () =>
    setScreen(screen === "type" && type !== "FIRM_REGISTRATION" ? "category" : "review");
  // Firm registration has no category to choose, so its review goes back to the type.
  const back = () =>
    setScreen(screen === "review" && type === "FIRM_REGISTRATION" ? "type" : SCREENS[at - 1]!);

  // The CV parts this application needs, and which are missing (UX-021).
  const cvNeeded =
    cvReady && category && type === "NEW" ? sectionsFor(type, category).filter(isCvSection) : [];
  const cv =
    cvReady && category && cvNeeded.length > 0
      ? {
          needed: cvNeeded,
          missing: cvNeeded.filter((key) => !cvReady[key]),
          href: `/settings/cv?${new URLSearchParams({
            part: cvNeeded.find((key) => !cvReady[key]) ?? cvNeeded[0]!,
            next: `/applications/new?type=${type}&category=${category}`,
          })}` as Route,
        }
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Where you are in the survey, and a way back. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ol
            className="flex items-center gap-1.5"
            aria-label={t("survey.progress", { current: at + 1, total: 3 })}
          >
            {SCREENS.map((s, i) => (
              <li
                key={s}
                aria-current={i === at ? "step" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-(--dur-3)",
                  i === at
                    ? "w-8 bg-primary"
                    : i < at
                      ? "w-4 bg-primary/50"
                      : "w-4 bg-foreground/15",
                )}
              />
            ))}
          </ol>
          {/* Outside the list: a list holds only its items (axe "list"). */}
          <span aria-hidden className="text-xs font-medium num text-muted-foreground">
            {t("survey.step", { current: at + 1, total: 3 })}
          </span>
        </div>
      </div>

      {/* A.3 — application type. */}
      {screen === "type" && (
        <section
          aria-labelledby="type-title"
          className="flex animate-rise flex-col gap-3 [animation-duration:var(--dur-3)]"
        >
          <h2 id="type-title" className="text-lg">
            {t("typeTitle")}
          </h2>
          <div
            className="grid gap-3 sm:grid-cols-2 @5xl/main:grid-cols-4"
            role="radiogroup"
            aria-labelledby="type-title"
          >
            {types.map((option) => {
              const Icon = TYPE_ICONS[option] ?? FilePlus2;
              const active = option === type;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseType(option)}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl p-4 text-left",
                    INTERACTIVE,
                    active ? SELECTED : cn(SURFACE, HOVER),
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary-soft text-primary-soft-foreground",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{tt(`${option}.name`)}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {tt(`${option}.summary`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t("r2Types")}</p>
        </section>
      )}

      {/* A.4 — category, with requirements, indicative fee and availability (FR-A-007). */}
      {screen === "category" && (
        <section
          aria-labelledby="category-title"
          className="flex animate-rise flex-col gap-3 [animation-duration:var(--dur-3)]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="category-title" className="text-lg">
              {t("categoryTitle")}
            </h2>
            <Link
              href="/eligibility"
              className="text-sm font-semibold text-link underline-offset-4 hover:underline"
            >
              {t("notSure")}
            </Link>
          </div>
          <div
            className="grid gap-3 sm:grid-cols-2 @5xl/main:grid-cols-4"
            role="radiogroup"
            aria-labelledby="category-title"
          >
            {categories.map((option) => {
              const reason = availability[type][option];
              const active = option === category;
              const req = CATEGORY_REQUIREMENTS[option];
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-disabled={Boolean(reason)}
                  onClick={() => {
                    if (reason) return;
                    setCategory(option);
                    setScreen("review");
                  }}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-2xl p-4 text-left",
                    !reason && INTERACTIVE,
                    active
                      ? SELECTED
                      : reason
                        ? cn(SURFACE_MUTED, "cursor-not-allowed")
                        : cn(SURFACE, HOVER),
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.7rem] font-bold text-primary-soft-foreground">
                      {CATEGORY_INFO[option].abbreviation}
                    </span>
                    {active ? (
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" strokeWidth={3} aria-hidden />
                      </span>
                    ) : reason ? (
                      <Lock className="size-4 text-muted-foreground" aria-hidden />
                    ) : null}
                  </div>
                  <span className={cn("text-sm font-semibold", reason && "text-muted-foreground")}>
                    {tc(`${option}.name`)}
                  </span>
                  <ul className="flex flex-wrap gap-1.5 text-[0.7rem] font-medium text-muted-foreground">
                    {req.education && (
                      <li className="rounded-full bg-muted px-2 py-0.5">
                        {t(`req.education.${req.education}`)}
                      </li>
                    )}
                    {req.experience && (
                      <li className="rounded-full bg-muted px-2 py-0.5">
                        {t("req.experience", {
                          years: req.experience.years,
                          as: CATEGORY_INFO[req.experience.as].abbreviation,
                        })}
                      </li>
                    )}
                    {req.prerequisite && (
                      <li className="rounded-full bg-muted px-2 py-0.5">
                        {t("req.prerequisite", {
                          licence: CATEGORY_INFO[req.prerequisite].abbreviation,
                        })}
                      </li>
                    )}
                    {req.training && (
                      <li className="rounded-full bg-muted px-2 py-0.5">{t("req.training")}</li>
                    )}
                    {req.exam && (
                      <li className="rounded-full bg-muted px-2 py-0.5">{t("req.exam")}</li>
                    )}
                  </ul>
                  {reason ? (
                    <span className="mt-auto text-xs font-medium text-link">
                      {t(`reasons.${reason}`)}
                    </span>
                  ) : (
                    <span className="mt-auto text-xs text-muted-foreground">
                      {t("fee", { amount: formatMoney(fees[option], "RWF", locale) })}
                      {sampleFees && ` · ${t("sample")}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {screen === "review" && category && (
        <ChosenSummary
          type={tt(`${type}.name`)}
          category={tc(`${category}.name`)}
          abbreviation={CATEGORY_INFO[category].abbreviation}
          onChangeType={types.length > 1 ? () => setScreen("type") : undefined}
          onChangeCategory={type === "FIRM_REGISTRATION" ? undefined : () => setScreen("category")}
          changeLabel={t("survey.change")}
        />
      )}

      {screen === "review" && type === "RENEWAL" && category && (
        <section aria-labelledby="licence-title" className="flex flex-col gap-3">
          <h2 id="licence-title" className="text-lg">
            {t("licenceTitle")}
          </h2>
          {renewable.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRenewable")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {renewable.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={(licenceId ?? renewable[0]?.id) === l.id}
                  onClick={() => setLicenceId(l.id)}
                  className={cn(
                    "flex flex-col gap-1 rounded-2xl p-4 text-left",
                    INTERACTIVE,
                    (licenceId ?? renewable[0]?.id) === l.id ? SELECTED : cn(SURFACE, HOVER),
                  )}
                >
                  <span className="font-mono text-sm font-semibold">{l.licenceNo}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("expires", { date: formatDay(l.expiresAt, locale) })}
                  </span>
                  {l.status === "EXPIRED" && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-link">
                      <TriangleAlert className="size-3.5" aria-hidden /> {t("lateFee")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Documents and fees, before anything is created (UX-005). */}
      {screen === "review" && category && !availability[type][category] && (
        <BeforeYouStart
          key={`${type}-${category}`}
          type={type}
          category={category}
          schedule={schedule}
          locale={locale}
          cv={cv}
        />
      )}

      {/* One navigation bar (UX-007), like the wizard's: Back, and Continue or Start. */}
      <footer className="sticky bottom-[calc(var(--bottom-nav-h,0px)+0.75rem)] z-20 -mx-2 flex items-center justify-between gap-3 rounded-full bg-card/85 p-1.5 shadow-[0_16px_40px_-14px_oklch(0.3_0.12_264/0.45)] ring-1 ring-foreground/[0.04] backdrop-blur-xl @4xl/main:static @4xl/main:mx-0 dark:bg-[oklch(0.22_0.02_265/0.88)] dark:ring-white/[0.06]">
        {canBack ? (
          <Button type="button" variant="ghost" onClick={back} className="group rounded-full">
            <ArrowLeft aria-hidden className="transition-transform group-hover:-translate-x-0.5" />{" "}
            {t("survey.back")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {screen === "review" && existing && (
            <Button asChild variant="ghost" className="rounded-full">
              <Link href={`/applications/${existing}/wizard` as Route}>{t("openExisting")}</Link>
            </Button>
          )}
          {screen === "review" && cv && cv.missing.length > 0 ? (
            // Qualifications come first (UX-021): complete the CV, then come back here to start.
            <Button asChild className="group rounded-full">
              <Link href={cv.href}>
                {t("completeCv")}
                <ArrowRight
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
          ) : screen === "review" ? (
            <Button
              onClick={start}
              loading={pending}
              className="group rounded-full"
              disabled={
                !category ||
                Boolean(availability[type][category]) ||
                (type === "RENEWAL" && renewable.length === 0)
              }
            >
              {t("start")}{" "}
              <ArrowRight
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={proceed}
              disabled={!canProceed}
              className="group rounded-full"
            >
              {t("survey.continue")}{" "}
              <ArrowRight
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

/** The choices made so far, each with a way to change it (the review screen's header). */
function ChosenSummary({
  type,
  category,
  abbreviation,
  onChangeType,
  onChangeCategory,
  changeLabel,
}: {
  type: string;
  category: string;
  abbreviation: string;
  onChangeType?: () => void;
  onChangeCategory?: () => void;
  changeLabel: string;
}) {
  const row = (label: React.ReactNode, onChange?: () => void) => (
    <span className="inline-flex items-center gap-2 rounded-full bg-card py-1.5 pr-1.5 pl-3.5 text-sm font-semibold ring-1 ring-border">
      {label}
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-link hover:bg-primary-soft"
        >
          {changeLabel}
        </button>
      )}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {row(type, onChangeType)}
      {row(
        <>
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.7rem] font-bold text-primary-soft-foreground">
            {abbreviation}
          </span>
          {category}
        </>,
        onChangeCategory,
      )}
    </div>
  );
}
