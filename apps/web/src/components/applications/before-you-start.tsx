"use client";

import { useTranslations } from "next-intl";
import {
  buildChecklist,
  calculateFees,
  type ApplicationType,
  type Category,
  type CvSection,
  type FeeSchedule,
} from "@rebp/contracts";

const CV_ICONS = { c: GraduationCap, d: Award, e: Briefcase } as const;
import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookUser,
  Briefcase,
  Check,
  Clock3,
  FileText,
  GraduationCap,
  Wallet,
} from "@/components/icons";
import { SURFACE } from "@/components/ui/surface";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * What the applicant needs before starting (UX-005, FR-A-007): the documents to have ready and
 * what they'll pay, from the same checklist and fee schedule the wizard and payment use, so
 * nothing changes after they begin. Conditional documents appear once answers trigger them.
 */
export function BeforeYouStart({
  type,
  category,
  schedule,
  locale,
  cv,
}: {
  type: ApplicationType;
  category: Category;
  schedule: FeeSchedule;
  locale: string;
  /** The CV parts this application needs, which are missing, and where to complete them. */
  cv?: { needed: CvSection[]; missing: CvSection[]; href: Route } | null;
}) {
  const tcv = useTranslations("cv");
  const t = useTranslations("applications.new.before");
  const td = useTranslations("wizard.documents.types");
  const tl = useTranslations("payment.lines");
  const documents = buildChecklist({ type, category, data: {} }).filter(
    (item) => item.requirement === "M",
  );
  const quote = calculateFees(schedule, { category, type });

  return (
    <section
      aria-labelledby="before-title"
      data-before-start
      className="flex animate-rise flex-col gap-4 [animation-duration:var(--dur-3)]"
    >
      <h2 id="before-title" className="text-lg">
        {t("title")}
      </h2>
      {/* Qualifications come from the CV (UX-021): ready, or completed first. */}
      {cv && (
        <div
          data-cv-ready={cv.missing.length === 0}
          className={cn("flex flex-wrap items-center gap-4 rounded-2xl p-4 sm:p-5", SURFACE)}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <BookUser className="size-4 text-link" aria-hidden />
            {t("cv")}
          </span>
          <ul className="flex flex-1 flex-wrap gap-2">
            {cv.needed.map((key) => {
              const Icon = CV_ICONS[key];
              const ready = !cv.missing.includes(key);
              return (
                <li
                  key={key}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium ring-1",
                    ready
                      ? "bg-primary-soft/60 ring-primary/15"
                      : "bg-danger-soft/50 ring-destructive/25",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-full",
                      ready
                        ? "bg-primary-soft text-link ring-1 ring-primary/30"
                        : "bg-card text-destructive",
                    )}
                  >
                    {ready ? (
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    ) : (
                      <Icon className="size-3.5" aria-hidden />
                    )}
                  </span>
                  {tcv(`sections.${key}`)}
                  <span className="sr-only">: {ready ? t("cvReady") : t("cvMissing")}</span>
                  {!ready && (
                    <span aria-hidden className="text-xs font-bold text-destructive">
                      {t("cvMissing")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {cv.missing.length > 0 && (
            <Link
              href={cv.href}
              className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-[0_6px_14px_-8px_var(--primary)]"
            >
              {t("cvComplete")}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          )}
        </div>
      )}
      <div className="grid gap-4 @3xl/main:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Documents to have ready. */}
        <div className={cn("flex flex-col gap-3 rounded-2xl p-5", SURFACE)}>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 text-link" aria-hidden />
              {t("docs")}
            </span>
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold num text-primary-soft-foreground">
              {t("docsCount", { count: documents.length })}
            </span>
          </div>
          <ul className="grid gap-x-6 gap-y-2.5 @xl/main:grid-cols-2">
            {documents.map((item) => (
              <li key={item.type} className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{td(`${item.type}.name`)}</span>
                <span className="text-xs text-muted-foreground">{td(`${item.type}.hint`)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t("more")}</p>
        </div>

        {/* What it costs, line by line. */}
        <div className={cn("flex flex-col gap-3 rounded-2xl p-5", SURFACE)}>
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Wallet className="size-4 text-link" aria-hidden />
            {t("fees")}
          </span>
          <dl className="flex flex-col gap-1.5 text-sm">
            {quote.lines.map((line) => (
              <div key={line.code} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{tl(line.code)}</dt>
                <dd className="num">{formatMoney(line.amount, quote.currency, locale)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-3 border-t border-foreground/[0.06] pt-2 font-semibold dark:border-white/[0.06]">
              <dt>{t("total")}</dt>
              <dd className="num">{formatMoney(quote.total, quote.currency, locale)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {t("payWhen")}
            {quote.sample && ` ${t("sample")}`}
          </p>
          <p className="mt-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" aria-hidden /> {t("time")}
          </p>
        </div>
      </div>
    </section>
  );
}
