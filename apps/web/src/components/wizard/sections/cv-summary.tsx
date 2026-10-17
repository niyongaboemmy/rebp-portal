"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CvSection, Qualification } from "@rebp/contracts";
import {
  Award,
  BadgeCheck,
  Briefcase,
  Check,
  ClipboardCheck,
  GraduationCap,
  PenLine,
  UserRound,
  type LucideIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSection, useWizard } from "../context";
import { cvHref } from "../cv-link";
import { useRuleSlot } from "../rules-ui";
import { StepDocuments } from "../step-documents";
import { ExperienceCoach } from "./experience";

const ICONS: Record<CvSection, LucideIcon> = { c: GraduationCap, d: Award, e: Briefcase };

/**
 * Education, training and experience in an application (UX-021): the applicant's CV, shown to
 * confirm — nothing to retype here. Only what this application decides is answered on the page:
 * which qualification it relies on. Every change to the CV itself opens the CV at that part and
 * comes back here. The step's uploads stay (the CV's files are copied in).
 */
export function CvStepSummary({ step }: { step: CvSection }) {
  const t = useTranslations("cv.step");
  const { application, issues } = useWizard();
  const Icon = ICONS[step];
  // Only the application's own choice is answered here; the rest is the CV's.
  const open = Object.keys(issues(step)).filter((path) => path !== "qualifications").length;
  const edit = cvHref(application.id, step);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="from-cv" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,var(--primary-soft),color-mix(in_oklch,var(--primary)_14%,var(--card)))] text-link">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col">
              <h3 id="from-cv" className="text-base font-semibold">
                {t("title")}
              </h3>
              <span className="text-xs text-muted-foreground">{t("hint")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {open > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-bold text-destructive">
                <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
                {t("missing", { count: open })}
              </span>
            )}
            <Button
              asChild
              variant={open > 0 ? "default" : "tonal"}
              size="sm"
              className="rounded-full"
            >
              <Link href={edit} data-path={`cv-${step}`}>
                <PenLine aria-hidden /> {open > 0 ? t("complete") : t("edit")}
              </Link>
            </Button>
          </div>
        </div>

        {step === "c" ? <Education /> : step === "d" ? <Training /> : <Experience />}
      </section>
      <StepDocuments step={step} />
    </div>
  );
}

/** One fact as an icon tile, a label and its value (or "Missing" in red). */
function Fact({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  value?: React.ReactNode;
  muted?: boolean;
}) {
  const t = useTranslations("cv.step");
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        <Icon className="size-[1.1rem]" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-sm font-semibold", muted && "text-muted-foreground")}>
          {value ?? <span className="text-destructive">{t("missingValue")}</span>}
        </span>
      </div>
    </div>
  );
}

function Education() {
  const t = useTranslations("cv.step");
  const tc = useTranslations("wizard.c");
  const s = useSection("c");
  const list = s.data.qualifications ?? [];
  const relied = s.error("qualifications");
  // Which qualification this application relies on: the one choice made here.
  const toggle = (index: number) =>
    s.set(
      "qualifications",
      list.map((q: Qualification, i) => (i === index ? { ...q, reliedUpon: !q.reliedUpon } : q)),
    );
  return (
    <div className="flex flex-col gap-3">
      <Fact
        icon={GraduationCap}
        label={tc("highestLevel")}
        value={s.data.highestLevel ? tc(`levels.${s.data.highestLevel}`) : undefined}
      />
      <div data-path="qualifications" className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{t("relyTitle")}</span>
        {list.map((q: Qualification, index) => (
          <button
            key={q.id}
            type="button"
            role="checkbox"
            aria-checked={Boolean(q.reliedUpon)}
            disabled={s.disabled}
            onClick={() => toggle(index)}
            className={cn(
              "flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-[background-color,box-shadow] duration-(--dur-2)",
              q.reliedUpon
                ? "bg-primary/[0.06] ring-primary/40 dark:bg-primary/[0.14]"
                : "bg-card ring-foreground/[0.06] hover:ring-primary/25 dark:bg-surface-2/70 dark:ring-white/[0.07]",
            )}
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <GraduationCap className="size-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">
                {q.qualification || tc("qualificationN", { n: index + 1 })}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {[q.institution, q.yearCompleted].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                "inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
                q.reliedUpon
                  ? "bg-primary text-primary-foreground"
                  : "ring-2 ring-foreground/15 ring-inset",
              )}
            >
              {q.reliedUpon && <Check className="size-3.5" strokeWidth={3} />}
            </span>
          </button>
        ))}
        {relied && list.length > 0 && (
          <span role="alert" className="text-xs font-semibold text-destructive">
            {t("relyNeeded")}
          </span>
        )}
      </div>
    </div>
  );
}

function Training() {
  const t = useTranslations("cv.step");
  const td = useTranslations("wizard.d");
  const { data, locale } = useWizard();
  const d = data.d ?? {};
  const provider =
    d.trainingProvider === "OTHER"
      ? d.trainingProviderOther
      : d.trainingProvider && td(`providers.${d.trainingProvider}`);
  return (
    <div className="grid grid-cols-1 gap-2 @xl/form:grid-cols-2">
      <Fact
        icon={Award}
        label={td("trainingTitle")}
        muted={d.trainingCompleted === false}
        value={
          d.trainingCompleted === undefined
            ? undefined
            : d.trainingCompleted && d.trainingProgramme
              ? [
                  td(`programmes.${d.trainingProgramme}`),
                  provider,
                  d.trainingCompletedOn && formatDay(d.trainingCompletedOn, locale),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : t("noTraining")
        }
      />
      <Fact
        icon={ClipboardCheck}
        label={td("examTitle")}
        muted={d.examPassed !== "YES"}
        value={
          d.examPassed === undefined
            ? undefined
            : d.examPassed === "YES"
              ? [td("exam.YES"), d.examDate && formatDay(d.examDate, locale)]
                  .filter(Boolean)
                  .join(" · ")
              : td(`exam.${d.examPassed}`)
        }
      />
    </div>
  );
}

function Experience() {
  const t = useTranslations("cv.step");
  const te = useTranslations("wizard.e");
  const router = useRouter();
  const { application, data, eligibility, sectionContext, locale } = useWizard();
  const e = data.e ?? {};
  const records = [...(e.records ?? [])].sort((a, b) => (b.from ?? "").localeCompare(a.from ?? ""));
  const target = application.category;
  const qualifying =
    eligibility.experience?.qualifyingCategories ??
    (target === "REA" ? ["FSLA"] : target === "BROKER" ? ["REA"] : []);
  // The coach shows the experience rule, so the issues block above doesn't repeat it.
  useRuleSlot(qualifying.length > 0 ? "e.records" : null);
  const go = (path: string) => router.push(cvHref(application.id, "e", { focus: path }));
  return (
    <div className="flex flex-col gap-4">
      {qualifying.length > 0 && (
        <ExperienceCoach
          summary={eligibility.experience ?? null}
          qualifying={qualifying}
          target={target}
          today={sectionContext.today}
          locale={locale}
          editable
          onAdd={() => router.push(cvHref(application.id, "e", { add: qualifying[0]! }))}
          go={go}
          notCounted={(e.records ?? []).flatMap((record, index) => {
            const reason = !record.category
              ? null
              : !qualifying.includes(record.category)
                ? ("category" as const)
                : !record.from
                  ? ("from" as const)
                  : null;
            return reason ? [{ index, record, reason }] : [];
          })}
        />
      )}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{te("recordsTitle")}</span>
        {records.length === 0 ? (
          <span className="text-sm text-muted-foreground">{t("noPeriods")}</span>
        ) : (
          records.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Briefcase className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{r.firm}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[
                    r.category && te(`categories.${r.category}`),
                    r.from &&
                      `${formatDay(r.from, locale)} – ${
                        r.current ? te("present") : r.to ? formatDay(r.to, locale) : "…"
                      }`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {r.category && qualifying.includes(r.category) && (
                <BadgeCheck className="size-5 shrink-0 text-link" aria-label={t("counts")} />
              )}
            </div>
          ))
        )}
      </div>
      {e.refereeName && (
        <Fact
          icon={UserRound}
          label={te("refereeTitle")}
          value={[e.refereeName, e.refereeRole].filter(Boolean).join(" · ")}
        />
      )}
    </div>
  );
}
