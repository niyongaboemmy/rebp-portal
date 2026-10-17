"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  buildChecklist,
  isRequiredForSubmission,
  isSatisfied,
  SECTION_KEYS,
  type SectionKey,
  type StepKey,
  isCvSection,
} from "@rebp/contracts";
import {
  AlertTriangle,
  ArrowLeft,
  Wallet,
  Briefcase,
  FileText,
  GraduationCap,
  PenLine,
  User,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDashed,
  Info,
  Loader2,
  Lock,
} from "@/components/icons";
import { ApplicationStages } from "@/components/applications/application-stages";
import { InfoTip } from "@/components/ui/info-tip";
import { Button } from "@/components/ui/button";
import { formatDay, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { rememberStepAction } from "@/server/actions/applications";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { fieldFor, useSectionPager } from "./section-pager";
import { focusField } from "./focus";
import { ErrorSummary } from "./step-status";
import { JourneyStatus, RuleSlotsProvider, StepBadge, StepIssues } from "./rules-ui";
import { NextFieldMarker } from "./next-field";
import {
  failingByStep,
  furthestReached,
  journeyOf,
  rulesOnStep,
  stepStateOf,
  type StepState,
} from "./state";
import { useWizard, WizardProvider, type WizardInit } from "./context";
import { pathForRule, WizardNavContext } from "./nav";
import { SectionAffiliation } from "./sections/affiliation";
import { SectionCategory } from "./sections/category";
import { SectionEducation } from "./sections/education";
import { SectionExperience } from "./sections/experience";
import { SectionIntegrity } from "./sections/integrity";
import { SectionPersonal } from "./sections/personal";
import { PersonalFromProfile } from "./sections/personal-summary";
import { CvStepSummary } from "./sections/cv-summary";
import { SectionTraining } from "./sections/training";
import { StepChecklist } from "./step-checklist";
import { StepIntro } from "./step-intro";
import { StepReview } from "./step-review";

/**
 * The guided application (FR-WIZ-001…014): steps generated from type × category (FR-WIZ-003), a
 * navigator with per-step state (FR-WIZ-005), autosave and resume (FR-WIZ-004), a help panel with
 * the legal basis (FR-WIZ-012), and live eligibility beside the form (FR-WIZ-007).
 */
export function Wizard({ init }: { init: WizardInit }) {
  return (
    <WizardProvider init={init}>
      <WizardShell />
    </WizardProvider>
  );
}

const SECTIONS: Record<SectionKey, () => React.ReactNode> = {
  b: PersonalStep,
  c: () => <CvStep step="c" form={SectionEducation} />,
  d: () => <CvStep step="d" form={SectionTraining} />,
  e: () => <CvStep step="e" form={SectionExperience} />,
  f: SectionAffiliation,
  g: SectionCategory,
  h: SectionIntegrity,
};

/**
 * Section B: an individual's personal details come from their profile (UX-010) — a summary to
 * confirm, not a form to retype. Organisations keep the form.
 */
function PersonalStep() {
  const { application } = useWizard();
  return application.accountType === "INDIVIDUAL" ? <PersonalFromProfile /> : <SectionPersonal />;
}

/**
 * Education, training and experience: an individual's come from their CV (UX-021) — a summary to
 * confirm, edited in the CV. Anyone else keeps the form.
 */
function CvStep({ step, form: Form }: { step: "c" | "d" | "e"; form: () => React.ReactNode }) {
  const { application } = useWizard();
  return fromAccount(application) ? <CvStepSummary step={step} /> : <Form />;
}

/** Whether an application's B–E come from the applicant's profile and CV (UX-010/021). */
const fromAccount = (application: { accountType: string; category: string }) =>
  application.accountType === "INDIVIDUAL" && application.category !== "REBF";

const isSection = (step: StepKey): step is SectionKey =>
  (SECTION_KEYS as readonly string[]).includes(step);

/**
 * The legal sections (A–I) grouped into four parts the applicant can hold in mind. Steps a
 * category does not need are simply absent from `steps`.
 */
const PHASES: { key: string; steps: StepKey[] }[] = [
  { key: "you", steps: ["a", "b"] },
  { key: "qualifications", steps: ["c", "d", "e"] },
  { key: "practice", steps: ["f", "g", "h"] },
  { key: "finish", steps: ["i", "review"] },
];

function WizardShell() {
  const t = useTranslations("wizard");
  const wizard = useWizard();
  const {
    application,
    steps,
    data,
    documents,
    issues,
    attempted,
    attempt,
    readOnly,
    flush,
    saveState,
  } = wizard;
  const [step, setStep] = useState<StepKey>(wizard.initialStep);
  const [summaryFocus, setSummaryFocus] = useState(0);
  const pagerRoot = useRef<HTMLDivElement>(null);
  const pager = useSectionPager(pagerRoot, step, isSection(step));
  const toTop = () =>
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const index = steps.indexOf(step);

  const checklistDone = useCallback(() => {
    const items = buildChecklist({ type: application.type, category: application.category, data });
    return items.every(
      (item) =>
        !isRequiredForSubmission(item) ||
        isSatisfied(documents.filter((d) => d.type === item.type).map((d) => d.status)),
    );
  }, [application, data, documents]);

  // Where eligibility stands for the steps reached so far (UX-004 §3.3).
  const journey = journeyOf(wizard.eligibility.rules, steps, furthestReached(steps, step, data));
  const ruleProblems = failingByStep(journey);
  const stateOf = (key: StepKey): StepState =>
    stepStateOf({
      step: key,
      issues: isSection(key) ? Object.keys(issues(key)).length : 0,
      attempted: isSection(key) && attempted(key),
      hasAnswers: isSection(key) && Object.keys((data[key] as object | undefined) ?? {}).length > 0,
      failing: ruleProblems.has(key),
      locked: isSection(key) && application.status === "ACTION_REQUIRED" && readOnly(key),
      checklistDone: key === "i" && checklistDone(),
    });

  const go = useCallback(
    (next: StepKey) => {
      // The rail's save indicator reports success; flush() toasts only failures.
      void flush();
      setStep(next);
      setHelpOpen(false);
      const url = new URL(window.location.href);
      url.searchParams.set("step", next);
      window.history.replaceState(null, "", url);
      startTransition(() => void rememberStepAction(application.id, next));
      requestAnimationFrame(() => {
        heading.current?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    },
    [application.id, flush],
  );

  // A changed ?step= (e.g. an "Edit" link in the summary) moves the wizard there.
  useEffect(() => {
    const onPop = () => {
      const param = new URL(window.location.href).searchParams.get("step") as StepKey | null;
      if (param && steps.includes(param)) setStep(param);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [steps]);

  const next = async () => {
    // Every step is saved before moving on; a failed save keeps the applicant here.
    if (!(await flush())) return;
    // A long section moves page by page; each page is checked before the next.
    if (isSection(step) && !pager.isLast) {
      const here = pager.pages[pager.page];
      const pageIssues = Object.keys(issues(step)).filter((path) => here?.owns(path));
      if (!readOnly(step) && pageIssues.length > 0) {
        attempt(step);
        setSummaryFocus((n) => n + 1);
        return;
      }
      pager.goTo(pager.page + 1);
      toTop();
      return;
    }
    if (isSection(step) && !readOnly(step)) {
      attempt(step);
      const count = Object.keys(issues(step)).length;
      if (count > 0) {
        // The error summary at the top lists each problem with a link to it.
        setSummaryFocus((n) => n + 1);
        return;
      }
    }
    const following = steps[index + 1];
    if (following) go(following);
  };

  const Section = isSection(step) ? SECTIONS[step] : null;
  // The parts that apply to this application, and where the applicant is.
  const phases = PHASES.map((p) => ({
    ...p,
    steps: p.steps.filter((s) => steps.includes(s)),
  })).filter((p) => p.steps.length > 0);
  const phaseIndex = Math.max(
    0,
    phases.findIndex((p) => p.steps.includes(step)),
  );
  // Issues on the page being shown (the whole step when it has one page).
  // "1 to fix" / "2 answers left" is a way there (UX-023): the first failing rule's answer,
  // else the first missing answer (highlighted from now on), else the issues above the form.
  const goToFirstProblem = () => {
    if (!isSection(step)) return;
    attempt(step);
    const rule = rulesOnStep(wizard.eligibility.rules, step).find((r) => r.outcome === "FAIL");
    const path = (rule && pathForRule(rule)) ?? Object.keys(issues(step))[0];
    if (path && fieldFor(path)) return focusField(path);
    document
      .querySelector("[data-issues], [data-path]")
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const visibleIssues = (() => {
    if (!isSection(step)) return {};
    const all = issues(step);
    if (pager.isLast) return all;
    const here = pager.pages[pager.page];
    return Object.fromEntries(Object.entries(all).filter(([path]) => here?.owns(path)));
  })();
  const left = isSection(step) && !readOnly(step) ? Object.keys(visibleIssues).length : null;
  // Where Next goes: the next page of this step, else the next step.
  const upNext =
    isSection(step) && !pager.isLast
      ? pager.pages[pager.page + 1]?.title || null
      : steps[index + 1]
        ? t(`steps.${steps[index + 1]!}.title`)
        : null;
  const back = () => {
    if (isSection(step) && !pager.isFirst) {
      pager.goTo(pager.page - 1);
      toTop();
    } else if (steps[index - 1]) go(steps[index - 1]!);
  };
  const saveExit = async () => {
    await flush();
    router.push(`/applications/${application.id}` as Route);
  };
  // Enter in a one-line field continues (not in text areas, menus or the review step).
  const onKeyDown = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      step === "review" ||
      step === "a" ||
      target.tagName !== "INPUT" ||
      (target as HTMLInputElement).type === "search" ||
      target.getAttribute("role") === "combobox"
    )
      return;
    event.preventDefault();
    void next();
  };
  const completed = steps.filter((s) => s !== "review" && stateOf(s) === "complete").length;
  const progress = Math.round((completed / (steps.length - 1)) * 100);

  return (
    <WizardNavContext.Provider value={go}>
      <RuleSlotsProvider>
        <div className="flex flex-col gap-5">
          {/* The whole path: fill in → sign → pay → submitted. */}
          <ApplicationStages
            current={step === "review" ? "sign" : "form"}
            hidePay={wizard.fee.total === 0 || application.status === "ACTION_REQUIRED"}
          />
          {application.status === "ACTION_REQUIRED" && application.infoRequest && (
            <div className="flex animate-rise items-start gap-3 rounded-2xl bg-primary-soft p-4 sm:p-5">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-link" aria-hidden />
              <div className="flex flex-col gap-1">
                <span className="font-semibold">
                  {t("actionRequired", {
                    due: formatDay(application.infoRequest.dueAt, wizard.locale),
                  })}
                </span>
                <p className="text-sm whitespace-pre-line">{application.infoRequest.message}</p>
                <p className="text-xs text-muted-foreground">{t("actionRequiredHint")}</p>
              </div>
            </div>
          )}

          {/* Mobile progress + step picker. */}
          <div className="flex flex-col gap-2 @4xl/main:hidden">
            {/* Phones: the fee where it matters (documents, review); the rail shows it on desktop. */}
            {(step === "i" || step === "review") && <FeeSummary inline />}
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>
                {t("partOf", { current: phaseIndex + 1, total: phases.length })} ·{" "}
                {t(`phases.${phases[phaseIndex]!.key}`)}
              </span>
              <SaveIndicator state={saveState} />
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={t("progress", { percent: progress })}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-(--dur-4)"
                style={{ width: `${progress}%` }}
              />
            </div>
            {step !== "a" && <JourneyStatus journey={journey} step={step} compact />}
            <div className="relative">
              <select
                aria-label={t("jumpTo")}
                value={step}
                onChange={(e) => go(e.target.value as StepKey)}
                className="h-12 w-full appearance-none rounded-xl bg-card px-4 pr-10 text-sm font-semibold raised"
              >
                {steps.map((s, i) => (
                  <option key={s} value={s}>
                    {i + 1}. {t(`steps.${s}.title`)} — {t(`state.${stateOf(s)}`)}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid items-start gap-5 @4xl/main:grid-cols-[16rem_minmax(0,1fr)]">
            {/* Step navigator (FR-WIZ-005). */}
            {/* Progress (FR-WIZ-005): one card — a ring and save status, the parts as equal rows
              (the current one opens to its steps on a connector line), and the fee as its footer. */}
            <nav
              aria-label={t("steps.label")}
              className="sticky top-24 hidden flex-col overflow-hidden rounded-[1.5rem] bg-card shadow-[0_1px_2px_oklch(0.3_0.08_264/0.06),0_16px_40px_-28px_oklch(0.35_0.15_264/0.45)] @4xl/main:flex dark:shadow-none dark:ring-1 dark:ring-white/[0.06]"
            >
              <div className="flex flex-col gap-3 border-b border-foreground/[0.06] p-4 dark:border-white/[0.06]">
                <div className="flex items-end justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold">{t("progressLabel")}</span>
                    <SaveIndicator state={saveState} />
                  </span>
                  <span
                    className={cn(
                      "text-2xl leading-none font-bold num tracking-[-0.03em]",
                      progress === 100 ? "text-link" : "text-foreground",
                    )}
                  >
                    {progress}
                    <span className="text-sm font-semibold text-muted-foreground">%</span>
                  </span>
                </div>
                {/* One segment per part, filling as its steps are done. */}
                <div
                  className="flex gap-1"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label={t("progress", { percent: progress })}
                >
                  {phases.map((phase, p) => {
                    const counted = phase.steps.filter((x) => x !== "review");
                    const share =
                      counted.filter((x) => stateOf(x) === "complete").length /
                      Math.max(1, counted.length);
                    const trouble = counted.some((x) => ["blocked", "errors"].includes(stateOf(x)));
                    return (
                      <span
                        key={phase.key}
                        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.08] dark:bg-surface-3"
                      >
                        <span
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-(--dur-4) ease-(--ease-enter)",
                            share === 1
                              ? "bg-primary"
                              : p === phaseIndex
                                ? "bg-[linear-gradient(90deg,var(--primary),var(--sky))]"
                                : "bg-primary/60",
                          )}
                          style={{ width: `${share * 100}%` }}
                        />
                        {trouble && (
                          <span className="absolute inset-y-0 right-0 w-1/3 rounded-full bg-destructive" />
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
              <JourneyStatus journey={journey} step={step} />
              <ol className="flex flex-col gap-0.5 p-1.5">
                {phases.map((phase, p) => {
                  const counted = phase.steps.filter((s) => s !== "review");
                  const doneCount = counted.filter((s) => stateOf(s) === "complete").length;
                  const done = doneCount === counted.length;
                  const troubled = counted.filter((s) =>
                    ["blocked", "errors"].includes(stateOf(s)),
                  );
                  const problems = troubled.length;
                  const here = p === phaseIndex;
                  const Icon = PHASE_ICON[phase.key] ?? FileText;
                  return (
                    <li
                      key={phase.key}
                      className={cn(
                        "rounded-2xl",
                        here && "bg-foreground/[0.03] dark:bg-surface-2/70",
                      )}
                    >
                      <button
                        type="button"
                        // With something to fix, straight to the first step that has it (UX-023).
                        onClick={() =>
                          go(
                            troubled[0] && troubled[0] !== step
                              ? troubled[0]
                              : here
                                ? step
                                : phase.steps[0]!,
                          )
                        }
                        aria-expanded={here}
                        className="flex h-12 w-full items-center gap-3 rounded-2xl px-2.5 text-left transition-colors hover:bg-foreground/[0.04] dark:hover:bg-surface-2"
                      >
                        <span
                          className={cn(
                            "inline-flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                            problems > 0
                              ? "bg-danger-soft text-destructive"
                              : done
                                ? "bg-primary-soft text-link"
                                : here
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-foreground/[0.06] text-muted-foreground dark:bg-surface-3",
                          )}
                        >
                          {problems > 0 ? (
                            <AlertTriangle className="size-4" aria-hidden />
                          ) : done ? (
                            <Check className="size-4" aria-hidden />
                          ) : (
                            <Icon className="size-4" aria-hidden />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {t(`phases.${phase.key}`)}
                        </span>
                        {problems > 0 ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[0.7rem] font-bold num text-white">
                            {t("toFix", { count: problems })}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-medium num text-muted-foreground">
                            {doneCount}/{counted.length}
                          </span>
                        )}
                      </button>
                      {here && (
                        <ol className="relative flex animate-rise flex-col pb-1.5 [animation-duration:var(--dur-3)]">
                          {/* Connector from the part icon down through the step marks. */}
                          <span
                            aria-hidden
                            className="absolute top-0 bottom-5 left-[1.625rem] w-px bg-foreground/10 dark:bg-white/10"
                          />
                          {phase.steps.map((s) => {
                            const state = stateOf(s);
                            const current = s === step;
                            return (
                              <li key={s} className="relative">
                                <button
                                  type="button"
                                  onClick={() => go(s)}
                                  aria-current={current ? "step" : undefined}
                                  className={cn(
                                    "group/st flex min-h-11 w-full items-center gap-3 rounded-xl py-1 pr-1.5 pl-[1.125rem] text-left text-sm transition-colors",
                                    current
                                      ? "font-semibold text-link"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  <StepMark state={state} current={current} />
                                  <span
                                    className={cn(
                                      "min-w-0 flex-1 truncate rounded-xl px-3.5 py-2 transition-colors",
                                      current
                                        ? "bg-primary-soft text-link dark:bg-primary/20"
                                        : "group-hover/st:bg-foreground/[0.04] dark:group-hover/st:bg-surface-2",
                                    )}
                                  >
                                    {t(`steps.${s}.title`)}
                                  </span>
                                  <span className="sr-only">{t(`state.${state}`)}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ol>

              <FeeSummary />
            </nav>

            {/* The step. */}
            <section
              aria-labelledby="step-title"
              onKeyDown={onKeyDown}
              className="glass @container/form flex min-w-0 flex-col gap-6 rounded-[1.75rem] p-5 ring-1 ring-primary/[0.08] sm:p-8 dark:ring-white/[0.06]"
            >
              <header className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    {/* The rail names the part on desktop; phones need it here. */}
                    <span className="text-xs font-bold tracking-widest text-link uppercase @4xl/main:hidden">
                      {t(`phases.${phases[phaseIndex]!.key}`)}
                    </span>
                    <h2
                      id="step-title"
                      ref={heading}
                      tabIndex={-1}
                      className="text-2xl font-bold tracking-[-0.02em] outline-none"
                    >
                      {t(`steps.${step}.title`)}
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setHelpOpen((o) => !o)}
                    aria-expanded={helpOpen}
                    aria-controls="step-help"
                  >
                    <Info aria-hidden /> <span className="hidden sm:inline">{t("help")}</span>
                  </Button>
                </div>
                {helpOpen && (
                  <div
                    id="step-help"
                    className="flex animate-rise flex-col gap-1.5 rounded-2xl bg-primary-soft p-4 text-sm leading-relaxed"
                  >
                    <span className="font-medium">{t(`steps.${step}.intro`)}</span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{t("whyTitle")}</span>{" "}
                      {t(`steps.${step}.help`)}{" "}
                      <span className="font-mono text-xs">({t(`steps.${step}.eyebrow`)})</span>
                    </span>
                  </div>
                )}
                {isSection(step) && application.status === "ACTION_REQUIRED" && readOnly(step) && (
                  <p className="flex items-center gap-2 rounded-xl bg-card px-3.5 py-2.5 text-sm text-muted-foreground ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]">
                    <Lock className="size-4" aria-hidden /> {t("locked")}
                  </p>
                )}
              </header>

              {/* What stands between the applicant and a licence, at the top of the form. */}
              {isSection(step) && <StepIssues step={step} />}
              {/* A dot beside the next open answer (UX-020). */}
              {isSection(step) && !readOnly(step) && <NextFieldMarker issues={issues(step)} />}
              {/* Pages of this section: where you are, and a tap to any of them. */}
              {/* Where you are in the step, and its state, on one row. */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 empty:hidden">
                {isSection(step) && pager.count > 1 && (
                  <ol
                    aria-label={t("pages.label")}
                    className="-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 pb-1"
                  >
                    {pager.pages.map((page, i) => {
                      // Problems on this page: shown once the step was attempted or the page passed.
                      const unanswered = Object.keys(issues(step as SectionKey)).filter((path) =>
                        page.owns(path),
                      ).length;
                      // A failing rule flags its page at once; missing answers after an attempt.
                      const failingHere = rulesOnStep(wizard.eligibility.rules, step).filter(
                        (rule) => rule.outcome === "FAIL" && page.owns(pathForRule(rule) ?? ""),
                      ).length;
                      // Missing answers count once the step was attempted or the page passed.
                      const answersDue = attempted(step as SectionKey) || i < pager.page;
                      const missing = failingHere + (answersDue ? unanswered : 0);
                      const flagged = !readOnly(step as SectionKey) && missing > 0;
                      const done = i < pager.page && missing === 0;
                      const now = i === pager.page;
                      return (
                        <li key={i} className="shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              pager.goTo(i);
                              toTop();
                            }}
                            aria-current={now ? "step" : undefined}
                            aria-label={
                              flagged
                                ? `${page.title || t("pages.more")}: ${t("pages.problems", { count: missing })}`
                                : undefined
                            }
                            className={cn(
                              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
                              now && flagged && "bg-destructive text-white",
                              now && !flagged && "bg-primary text-primary-foreground",
                              !now &&
                                flagged &&
                                "bg-danger-soft text-destructive ring-1 ring-destructive/40 ring-inset",
                              !now && !flagged && done && "bg-primary-soft text-link",
                              !now &&
                                !flagged &&
                                !done &&
                                "bg-foreground/[0.05] text-muted-foreground hover:text-foreground dark:bg-surface-2",
                            )}
                          >
                            {flagged ? (
                              <span
                                aria-hidden
                                className={cn(
                                  "inline-flex size-4 items-center justify-center rounded-full text-[0.6rem] font-bold num",
                                  now ? "bg-white/25" : "bg-destructive text-white",
                                )}
                              >
                                {missing}
                              </span>
                            ) : done ? (
                              <Check className="size-3.5" aria-hidden />
                            ) : (
                              <span className="num">{i + 1}</span>
                            )}
                            {page.title || t("pages.more")}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {left !== null && (
                  <StepBadge
                    onGo={goToFirstProblem}
                    left={left}
                    failing={ruleProblems.get(step) ?? 0}
                    officer={
                      journey.officer.filter((r) => rulesOnStep([r], step).length > 0).length
                    }
                  />
                )}
              </div>
              {/* Step B from the profile says what's missing itself, with a way to the profile. */}
              {isSection(step) &&
                !((step === "b" || isCvSection(step)) && fromAccount(application)) && (
                  <ErrorSummary
                    issues={attempted(step) ? visibleIssues : {}}
                    show={attempted(step)}
                    focusKey={summaryFocus}
                  />
                )}
              {/* Keyed by step: each one slides in. */}
              <div
                key={step}
                className="flex animate-rise flex-col gap-6 [animation-duration:var(--dur-3)]"
              >
                {step === "a" && <StepIntro onNext={next} steps={phases.length} />}
                {Section && (
                  <div ref={pagerRoot} className={cn(!pager.ready && "invisible")}>
                    <Section />
                  </div>
                )}
                {step === "i" && <StepChecklist />}
                {step === "review" && <StepReview goTo={go} />}
              </div>

              {step !== "a" && (
                // One navigation bar (UX-007): on phones it floats above the shell's tab bar, in
                // reach on a long page; on desktop it ends the card, so it never covers a control
                // (WCAG 2.4.11, 2.5.8). "Up next" names where Next goes.
                <footer className="sticky bottom-[calc(var(--bottom-nav-h,0px)+0.75rem)] z-20 -mx-2 mt-2 flex items-center justify-between gap-3 rounded-full bg-card/85 p-1.5 shadow-[0_16px_40px_-14px_oklch(0.3_0.12_264/0.45)] ring-1 ring-foreground/[0.04] backdrop-blur-xl @4xl/main:static @4xl/main:mx-0 dark:bg-[oklch(0.22_0.02_265/0.88)] dark:ring-white/[0.06]">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={back}
                      disabled={index === 0 && pager.isFirst}
                      className="group rounded-full"
                    >
                      <ArrowLeft
                        aria-hidden
                        className="transition-transform group-hover:-translate-x-0.5"
                      />{" "}
                      {t("back")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void saveExit()}
                      className="rounded-full text-muted-foreground max-sm:hidden"
                    >
                      {t("saveExit")}
                    </Button>
                  </div>
                  {step !== "review" && (
                    <div className="flex min-w-0 items-center gap-3">
                      {upNext && (
                        <span className="min-w-0 truncate text-xs text-muted-foreground max-sm:hidden">
                          {t("upNext", { title: upNext })}
                        </span>
                      )}
                      <Button type="button" onClick={next} className="group shrink-0 rounded-full">
                        {isSection(step) && !pager.isLast ? t("pages.next") : t("saveContinue")}{" "}
                        <ArrowRight
                          aria-hidden
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </Button>
                    </div>
                  )}
                </footer>
              )}
            </section>
          </div>
        </div>
      </RuleSlotsProvider>
    </WizardNavContext.Provider>
  );
}

const PHASE_ICON: Record<string, typeof FileText> = {
  you: User,
  qualifications: GraduationCap,
  practice: Briefcase,
  finish: PenLine,
};

/** A small status mark for a step inside the open part. */
function StepMark({ state, current }: { state: StepState; current: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-10 inline-flex size-4 shrink-0 items-center justify-center rounded-full",
        state === "complete" && "bg-primary-soft text-link ring-1 ring-primary/30",
        (state === "errors" || state === "blocked") && "bg-destructive text-white",
        state === "locked" && "bg-muted text-muted-foreground",
        (state === "inProgress" || state === "notStarted") &&
          (current
            ? "bg-card ring-2 ring-primary ring-inset dark:bg-[oklch(0.2_0.02_265)]"
            : "bg-card ring-2 ring-foreground/20 ring-inset dark:bg-[oklch(0.2_0.02_265)] dark:ring-white/25"),
      )}
    >
      {state === "complete" ? (
        <Check className="size-2.5" strokeWidth={2.5} />
      ) : state === "errors" || state === "blocked" ? (
        <span className="text-[0.6rem] font-bold">!</span>
      ) : state === "locked" ? (
        <Lock className="size-2.5" />
      ) : current ? (
        <span className="size-1.5 rounded-full bg-primary" />
      ) : null}
    </span>
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const t = useTranslations("wizard.save");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        state === "error" ? "text-destructive" : "text-muted-foreground",
      )}
      role="status"
      aria-live="polite"
    >
      {state === "saving" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {state === "saved" && <Check className="size-3.5 text-link" aria-hidden />}
      {state === "idle" && <CircleDashed className="size-3.5" aria-hidden />}
      {state === "error" && <AlertTriangle className="size-3.5" aria-hidden />}
      {t(state)}
    </span>
  );
}

/** The fee, compact: under the progress list (desktop) or above the step picker (phones). */
function FeeSummary({ inline = false }: { inline?: boolean }) {
  const t = useTranslations("wizard");
  const { fee, application, locale } = useWizard();
  if (fee.total <= 0 || application.status !== "DRAFT") return null;
  const note = fee.sample ? t("feeSample") : t("feeHint");
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        inline
          ? "rounded-2xl bg-card px-4 py-3 dark:bg-surface-2/70 dark:ring-1 dark:ring-white/[0.06]"
          : "border-t border-foreground/[0.06] px-4 py-3 dark:border-white/[0.06]",
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Wallet className="size-4 text-link" aria-hidden />
        {t("feeTitle")}
        <InfoTip>{note}</InfoTip>
      </span>
      <span className="text-sm font-bold num">{formatMoney(fee.total, fee.currency, locale)}</span>
    </div>
  );
}
