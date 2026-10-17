"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Cake,
  Check,
  Clock3,
  FileText,
  GraduationCap,
  Minus,
  PenLine,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  User,
  type LucideIcon,
} from "@/components/icons";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  CATEGORY_INFO,
  EDUCATION_LEVELS,
  HELD_LICENCES,
  PRECHECK_DOCUMENTS,
  precheck,
  type Category,
  type PrecheckAnswers,
} from "@rebp/contracts";
import type { LadderMarker } from "@/components/categories/category-ladder";
import { CategoryMap } from "@/components/categories/category-map";
import { Standing, standingOf, type MapResult } from "@/components/categories/standing";
import { Meter } from "@/components/data/meter";
import { SketchUnderline } from "@/components/motion/sketch-underline";
import { EligibilityPerson, type PersonMood } from "./eligibility-person";
import { TIER_TILE } from "@/components/registry/tones";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Step = "who" | "age" | "education" | "licence" | "years" | "result";
type Question = Exclude<Step, "result">;

const INITIAL: PrecheckAnswers = {
  applicantType: "INDIVIDUAL",
  adult: true,
  education: "A2",
  licence: "NONE",
  years: 0,
};

const STEP_ICON: Record<Question, LucideIcon> = {
  who: User,
  age: Cake,
  education: GraduationCap,
  licence: BadgeCheck,
  years: Clock3,
};

const YEAR_CHIPS = [0, 1, 2, 3, 5, 10] as const;

const card =
  "rounded-[1.75rem] bg-card shadow-[0_1px_2px_oklch(0.3_0.08_264/0.06),0_24px_60px_-34px_oklch(0.35_0.15_264/0.45)] dark:bg-white/[0.04] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]";

/**
 * "Am I eligible?" (FR-PORTAL-006). One question at a time in a card with its step and a
 * segmented progress bar; answers are numbered cards that advance on tap (or press 1–9).
 * Beside it, "Your answers" grows as you go and every answer can be edited in one tap (jumps
 * back to that question, keeping the rest). The result shows the recommended category, progress
 * towards the next one, a document checklist you can tick off, the ladder and next steps.
 * Indicative only; the wizard applies the full rules.
 */
export function EligibilityQuiz({ target }: { target?: Category }) {
  const t = useTranslations("eligibility");
  const tc = useTranslations("categories");
  const [answers, setAnswers] = useState<PrecheckAnswers>(INITIAL);
  const [history, setHistory] = useState<Step[]>(["who"]);
  const step = history[history.length - 1]!;
  const top = useRef<HTMLDivElement>(null);

  const flow: Step[] =
    answers.applicantType === "ORGANISATION"
      ? ["who", "result"]
      : answers.licence === "NONE"
        ? ["who", "age", "education", "licence", "result"]
        : ["who", "age", "education", "licence", "years", "result"];
  const questions = flow.slice(0, -1) as Question[];
  const position = Math.max(0, questions.indexOf(step as Question));
  const answered = history.slice(0, -1) as Question[];

  // Bring the card into view on each step (phones: the summary sits above it).
  useEffect(() => {
    const el = top.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < 64)
      el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const go = (next: Step) => setHistory((h) => [...h, next]);
  const answer = (patch: Partial<PrecheckAnswers>, next: Step) => {
    setAnswers((a) => ({ ...a, ...patch }));
    go(next);
  };
  const back = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const jumpTo = (s: Question) =>
    setHistory((h) => (h.includes(s) ? h.slice(0, h.indexOf(s) + 1) : h));
  const restart = () => {
    setAnswers(INITIAL);
    setHistory(["who"]);
  };

  const summaryValue = (s: Question): string => {
    switch (s) {
      case "who":
        return answers.applicantType === "ORGANISATION" ? t("a.firm") : t("a.individual");
      case "age":
        return answers.adult ? t("a.yes") : t("a.no");
      case "education":
        return t(`educationLevels.${answers.education}`);
      case "licence":
        return answers.licence === "NONE" ? t("a.noLicence") : tc(`items.${answers.licence}.name`);
      case "years":
        return `${answers.years}${answers.years >= 10 ? "+" : ""} ${t("yearsUnit", { count: answers.years })}`;
    }
  };

  const summary = (
    <aside aria-labelledby="answers-title" className={cn(card, "flex flex-col gap-4 p-5 sm:p-6")}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="answers-title" className="text-base font-bold">
          {t("summary.title")}
        </h2>
        {answered.length > 0 && (
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-link hover:underline"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {t("result.restart")}
          </button>
        )}
      </div>
      {answered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("summary.empty")}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {answered.map((s) => {
            const Icon = STEP_ICON[s];
            return (
              <li key={s} className="animate-rise [animation-duration:var(--dur-3)]">
                <button
                  type="button"
                  onClick={() => jumpTo(s)}
                  aria-label={t("summary.edit", { question: t(`short.${s}`) })}
                  className="group flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05]"
                >
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link dark:bg-white/[0.06]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
                      {t(`short.${s}`)}
                    </span>
                    <span className="truncate text-sm font-medium">{summaryValue(s)}</span>
                  </span>
                  <PenLine
                    className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-lg:opacity-60"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="flex items-start gap-2 border-t border-foreground/[0.07] pt-4 text-xs text-muted-foreground">
        <Sparkles className="mt-px size-3.5 shrink-0 text-link" aria-hidden />
        {t("summary.private")}
      </p>
    </aside>
  );

  const mood: PersonMood =
    step !== "result" ? "thinking" : precheck(answers).recommended ? "happy" : "hopeful";

  // The hero: the question on the left, the companion on the right (smaller on phones).
  const hero = (
    <section className="relative isolate">
      <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-72 bg-imigongo-fade text-link opacity-[0.05]"
      />
      <div className="container-page flex items-center gap-4 pt-7 pb-6 sm:gap-8 sm:pt-9 sm:pb-7">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <span className="inline-flex w-fit animate-rise items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-foreground">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inset-0 animate-ping rounded-full bg-ember/70" />
              <span className="relative size-1.5 rounded-full bg-ember" />
            </span>
            {t("eyebrow")}
          </span>
          <div className="flex flex-col gap-2">
            <h1
              className="animate-rise text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] leading-[1.08] font-bold tracking-[-0.02em] text-balance"
              style={{ animationDelay: "60ms" }}
            >
              {t("title")}
            </h1>
            <SketchUnderline className="h-2 w-24 sm:h-2.5 sm:w-32" />
          </div>
          <p
            className="max-w-xl animate-rise text-sm text-muted-foreground sm:text-base"
            style={{ animationDelay: "120ms" }}
          >
            {t("metaDescription")}
          </p>
        </div>
        <EligibilityPerson
          key={mood}
          mood={mood}
          className="w-28 shrink-0 animate-pop sm:w-44 lg:w-60"
        />
      </div>
    </section>
  );

  if (step === "result")
    return (
      <>
        {hero}
        <div ref={top} className="container-page scroll-mt-24 pb-20 sm:pb-28">
          <Result
            answers={answers}
            onRestart={restart}
            onEdit={() => setHistory((h) => h.slice(0, -1))}
            target={target}
          />
        </div>
      </>
    );

  return (
    <>
      {hero}
      <div className="container-page pb-20 sm:pb-28">
        <div
          ref={top}
          className="grid scroll-mt-24 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8"
        >
          <section className={cn(card, "flex flex-col gap-6 p-5 sm:p-8")} aria-live="polite">
            {/* Arrived from a category ("Check for G4"): the goal stays visible while answering. */}
            {target && <GoalBanner target={target} />}
            {/* Step header: back, "Question 2 of 4", segments (answered ones jump back). */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={back}
                  disabled={history.length === 1}
                  aria-label={t("back")}
                  className="inline-flex size-9 items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/80 transition-[background-color,opacity] hover:bg-foreground/[0.09] disabled:opacity-0 dark:bg-white/[0.06]"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <span className="text-xs font-semibold num text-muted-foreground">
                  {t("progress", { step: position + 1, total: questions.length })}
                </span>
              </div>
              <div
                className="flex gap-1.5"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={questions.length}
                aria-valuenow={position + 1}
                aria-label={t("progress", { step: position + 1, total: questions.length })}
              >
                {questions.map((s, i) => (
                  <span
                    key={s}
                    className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.08] dark:bg-white/[0.08]"
                  >
                    <span
                      className={cn(
                        "absolute inset-0 origin-left rounded-full bg-[linear-gradient(90deg,var(--primary),var(--sky))] transition-transform duration-(--dur-4) ease-(--ease-enter)",
                        i <= position ? "scale-x-100" : "scale-x-0",
                      )}
                    />
                  </span>
                ))}
              </div>
            </div>

            {/* Keyed by step so each question animates in. */}
            <div key={step} className="animate-rise [animation-duration:var(--dur-3)]">
              {step === "who" && (
                <QuestionBlock title={t("q.who")} hint={t("hints.who")} step={step}>
                  <Options
                    options={[
                      {
                        icon: User,
                        label: t("a.individual"),
                        detail: t("a.individualDetail"),
                        selected:
                          answered.includes("who") && answers.applicantType === "INDIVIDUAL",
                        onSelect: () => answer({ applicantType: "INDIVIDUAL" }, "age"),
                      },
                      {
                        icon: Building2,
                        label: t("a.firm"),
                        detail: t("a.firmDetail"),
                        selected:
                          answered.includes("who") && answers.applicantType === "ORGANISATION",
                        onSelect: () => answer({ applicantType: "ORGANISATION" }, "result"),
                      },
                    ]}
                  />
                </QuestionBlock>
              )}
              {step === "age" && (
                <QuestionBlock title={t("q.age")} hint={t("hints.age")} step={step}>
                  <Options
                    options={[
                      {
                        icon: Check,
                        label: t("a.yes"),
                        onSelect: () => answer({ adult: true }, "education"),
                      },
                      {
                        icon: Clock3,
                        label: t("a.no"),
                        onSelect: () => answer({ adult: false }, "education"),
                      },
                    ]}
                  />
                </QuestionBlock>
              )}
              {step === "education" && (
                <QuestionBlock title={t("q.education")} hint={t("hints.education")} step={step}>
                  <Options
                    options={EDUCATION_LEVELS.map((level) => ({
                      icon: GraduationCap,
                      label: t(`educationLevels.${level}`),
                      onSelect: () => answer({ education: level }, "licence"),
                    }))}
                  />
                </QuestionBlock>
              )}
              {step === "licence" && (
                <QuestionBlock title={t("q.licence")} hint={t("hints.licence")} step={step}>
                  <Options
                    options={HELD_LICENCES.map((licence) => ({
                      icon: BadgeCheck,
                      label: licence === "NONE" ? t("a.noLicence") : tc(`items.${licence}.name`),
                      badge: licence === "NONE" ? undefined : CATEGORY_INFO[licence].section,
                      tile: licence === "NONE" ? undefined : TIER_TILE[CATEGORY_INFO[licence].tier],
                      onSelect: () =>
                        answer({ licence, years: 0 }, licence === "NONE" ? "result" : "years"),
                    }))}
                  />
                </QuestionBlock>
              )}
              {step === "years" && (
                <QuestionBlock
                  title={t("q.years", {
                    category: CATEGORY_INFO[answers.licence as "FSLA"].abbreviation,
                  })}
                  hint={t("hints.years")}
                  step={step}
                >
                  <YearsPicker
                    value={answers.years}
                    onChange={(years) => setAnswers((a) => ({ ...a, years }))}
                  />
                  <button
                    type="button"
                    onClick={() => go("result")}
                    className="group mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)] sm:w-auto sm:self-end"
                  >
                    {t("seeResult")}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-1"
                      aria-hidden
                    />
                  </button>
                </QuestionBlock>
              )}
            </div>
          </section>

          {/* Phones: answers under the question; desktop: a sticky side panel. */}
          <div className="lg:sticky lg:top-24">{summary}</div>
        </div>
      </div>
    </>
  );
}

function QuestionBlock({
  title,
  hint,
  step,
  children,
}: {
  title: string;
  hint: string;
  step: Question;
  children: React.ReactNode;
}) {
  const Icon = STEP_ICON[step];
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="contents">
        <span className="mb-1 flex items-start gap-3.5">
          <span className="inline-flex size-11 shrink-0 animate-pop items-center justify-center rounded-2xl bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--primary)_65%,var(--sky)))] text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-[clamp(1.35rem,1.15rem+0.9vw,1.85rem)] leading-tight font-bold tracking-[-0.02em]">
              {title}
            </span>
            <span className="text-sm text-muted-foreground">{hint}</span>
          </span>
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

interface OptionSpec {
  icon: LucideIcon;
  label: string;
  detail?: string;
  badge?: string;
  tile?: string;
  selected?: boolean;
  onSelect: () => void;
}

/** Numbered answer cards; 1–9 on the keyboard picks one. Two columns when there are many. */
function Options({ options }: { options: OptionSpec[] }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) {
        event.preventDefault();
        options[n - 1]!.onSelect();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options]);

  return (
    <div className={cn("grid gap-2.5", options.length > 2 && "sm:grid-cols-2")}>
      {options.map((o, i) => {
        const Icon = o.icon;
        return (
          <button
            key={o.label}
            type="button"
            onClick={o.onSelect}
            style={{ animationDelay: `${60 + i * 50}ms` }}
            className={cn(
              "group relative flex min-h-16 w-full animate-rise items-center gap-3.5 rounded-2xl p-3.5 text-left transition-[background-color,box-shadow,transform] duration-(--dur-2) outline-none [animation-duration:var(--dur-3)] focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.98]",
              o.selected
                ? "bg-primary-soft shadow-[inset_0_0_0_1.5px_var(--primary)] dark:bg-primary/15"
                : "bg-foreground/[0.04] shadow-[inset_0_0_0_1px_transparent] hover:bg-card hover:shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--primary)_55%,transparent),0_12px_28px_-18px_oklch(0.35_0.15_264/0.5)] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]",
            )}
          >
            {o.badge ? (
              <span
                className={cn(
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white transition-transform duration-(--dur-3) ease-spring group-hover:-rotate-6",
                  o.tile,
                )}
              >
                {o.badge}
              </span>
            ) : (
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-link shadow-sm transition-[transform,background-color,color] duration-(--dur-3) ease-spring group-hover:-rotate-6 group-hover:bg-primary group-hover:text-primary-foreground dark:bg-white/[0.06]">
                <Icon className="size-5" aria-hidden />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[0.95rem] leading-snug font-semibold">{o.label}</span>
              {o.detail && (
                <span className="text-xs leading-snug text-muted-foreground">{o.detail}</span>
              )}
            </span>
            {o.selected ? (
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3.5" aria-hidden />
              </span>
            ) : (
              <>
                <kbd
                  aria-hidden
                  className="hidden size-6 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06] font-mono text-[0.7rem] font-semibold text-muted-foreground group-hover:hidden lg:inline-flex dark:bg-white/[0.08]"
                >
                  {i + 1}
                </kbd>
                <ArrowRight
                  className="size-5 shrink-0 text-link transition-transform duration-(--dur-2) group-hover:translate-x-1 lg:hidden lg:group-hover:inline"
                  aria-hidden
                />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function YearsPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useTranslations("eligibility");
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-foreground/[0.04] p-5 sm:p-6 dark:bg-white/[0.04]">
      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={t("fewer")}
          disabled={value === 0}
          className="inline-flex size-14 items-center justify-center rounded-2xl bg-card shadow-sm transition-[transform,opacity] active:scale-90 disabled:opacity-40 dark:bg-white/[0.08]"
        >
          <Minus className="size-6" />
        </button>
        <output aria-live="polite" className="flex w-24 flex-col items-center">
          <span key={value} className="animate-pop text-6xl font-extrabold num">
            {value}
            {value >= 10 ? "+" : ""}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {t("yearsUnit", { count: value })}
          </span>
        </output>
        <button
          type="button"
          onClick={() => onChange(Math.min(10, value + 1))}
          aria-label={t("more")}
          disabled={value === 10}
          className="inline-flex size-14 items-center justify-center rounded-2xl bg-card shadow-sm transition-[transform,opacity] active:scale-90 disabled:opacity-40 dark:bg-white/[0.08]"
        >
          <Plus className="size-6" />
        </button>
      </div>
      {/* Quick picks. */}
      <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label={t("quick")}>
        {YEAR_CHIPS.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onChange(y)}
            aria-pressed={value === y}
            className="h-8 min-w-11 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {y}
            {y === 10 ? "+" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "Checking for: G4 Real Estate Broker" with a way to drop the goal and check generally. */
function GoalBanner({ target }: { target: Category }) {
  const t = useTranslations("eligibility.goal");
  const tc = useTranslations("categories");
  const info = CATEGORY_INFO[target];
  return (
    <div className="flex animate-rise items-center gap-3 rounded-2xl bg-primary-soft/70 p-2.5 pr-3 dark:bg-primary/15">
      <span
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white",
          TIER_TILE[info.tier],
        )}
      >
        {info.section}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
          {t("checkingFor")}
        </span>
        <span className="truncate text-sm font-semibold">{tc(`items.${target}.name`)}</span>
      </span>
      <Link
        href="/eligibility"
        replace
        scroll={false}
        className="shrink-0 text-xs font-semibold text-link hover:underline"
      >
        {t("any")}
      </Link>
    </div>
  );
}

/** The result for the category they came to check: qualify (apply), or what is still missing. */
function GoalResult({ target, result }: { target: Category; result: MapResult }) {
  const t = useTranslations("eligibility.goal");
  const tc = useTranslations("categories");
  const tm = useTranslations("landing.map");
  const s = standingOf(target, result);
  const info = CATEGORY_INFO[target];
  return (
    <section
      aria-labelledby="goal-title"
      className={cn(card, "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6")}
    >
      <span
        className={cn(
          "inline-flex size-14 shrink-0 items-center justify-center rounded-2xl font-mono text-base font-bold text-white",
          TIER_TILE[info.tier],
        )}
      >
        {info.section}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("yourGoal")}
        </span>
        <h3 id="goal-title" className="text-lg leading-tight font-bold">
          {tc(`items.${target}.name`)}
        </h3>
        <Standing category={target} result={result} />
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        {s.tone === "eligible" ? (
          <Link
            href="/sign-up"
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
          >
            {tm("applyAs", { category: info.abbreviation })}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        ) : (
          <a
            href="#where-you-stand"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground/[0.05] px-5 text-sm font-semibold transition-colors hover:bg-foreground/[0.09] dark:bg-white/[0.06]"
          >
            {t("seePath")}
          </a>
        )}
      </div>
    </section>
  );
}

function Result({
  answers,
  onRestart,
  onEdit,
  target,
}: {
  answers: PrecheckAnswers;
  onRestart: () => void;
  onEdit: () => void;
  target?: Category;
}) {
  const t = useTranslations("eligibility");
  const tc = useTranslations("categories");
  const td = useTranslations("eligibility.documents");
  const { results, recommended, next } = precheck(answers);
  const eligible = results.filter((r) => r.status === "eligible");
  const docs = recommended ? PRECHECK_DOCUMENTS[recommended] : [];
  const [ready, setReady] = useState<Set<string>>(new Set());
  const [shared, setShared] = useState(false);

  const markers: LadderMarker[] = [];
  if (answers.licence !== "NONE") markers.push({ category: answers.licence, kind: "current" });
  if (recommended) markers.push({ category: recommended, kind: "recommended" });
  if (next && next.category !== recommended)
    markers.push({ category: next.category, kind: "next" });
  // The map and goal card read the same result.
  const mapResult: MapResult = {
    checks: Object.fromEntries(results.map((r) => [r.category, r])),
    held: answers.licence === "NONE" ? null : answers.licence,
    onEdit,
  };
  // Nothing open yet: the first rung is the goal.
  if (markers.length === 0) markers.push({ category: "RERA", kind: "next" });

  const share = async () => {
    const text = recommended
      ? t("shareText", { category: tc(`items.${recommended}.name`) })
      : t("title");
    try {
      if (navigator.share)
        await navigator.share({ title: t("title"), text, url: window.location.href });
      else {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      /* the user dismissed the share sheet */
    }
  };
  const toggle = (doc: string) =>
    setReady((r) => {
      const n = new Set(r);
      if (n.has(doc)) n.delete(doc);
      else n.add(doc);
      return n;
    });

  // Not eligible yet: what stands in the way of the first rung (Referral Agent).
  const entry = results.find((r) => r.category === "RERA");
  const blockers = recommended ? [] : (entry?.missing ?? []);
  const yearsLeft = next?.experience ? next.experience.required - next.experience.years : 0;

  const [celebrate, setCelebrate] = useState(true);
  const mapRef = useRef<HTMLElement>(null);
  const showMap = () => {
    setCelebrate(false);
    // After the dialog has closed: glide to "Where you stand".
    setTimeout(() => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  };

  return (
    <div className="flex flex-col gap-8 sm:gap-10" aria-live="polite">
      <Celebration
        open={celebrate}
        recommended={recommended}
        blockers={blockers}
        onContinue={showMap}
      />

      {/* Verdict. */}
      <div
        className={cn(
          "relative isolate flex flex-col gap-4 overflow-hidden rounded-[1.75rem] p-6 sm:flex-row sm:items-center sm:p-8",
          recommended
            ? "bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--primary)_60%,var(--sky)))] text-primary-foreground dark:bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_45%,oklch(0.18_0.03_265)),oklch(0.17_0.025_265))] dark:ring-1 dark:ring-primary/30"
            : cn(card),
        )}
      >
        {recommended && (
          <>
            <div aria-hidden className="absolute inset-0 -z-10 bg-imigongo opacity-[0.1]" />
            <div
              aria-hidden
              className="absolute -top-16 -right-10 -z-10 size-56 rounded-full bg-sun/30 blur-3xl dark:bg-primary/40"
            />
          </>
        )}
        <span
          className={cn(
            "inline-flex size-16 shrink-0 animate-pop items-center justify-center rounded-2xl font-mono text-lg font-bold",
            recommended
              ? "bg-white/95 text-primary dark:bg-white/10 dark:text-white"
              : "bg-warning-soft text-warning",
          )}
        >
          {recommended ? CATEGORY_INFO[recommended].section : <BadgeCheck className="size-8" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className={cn(
              "text-sm font-semibold",
              recommended ? "opacity-90" : "text-muted-foreground",
            )}
          >
            {recommended ? t("result.youCanApply") : t("result.notYet")}
          </span>
          <h2 className="text-[clamp(1.5rem,1.2rem+1.4vw,2.25rem)] leading-tight font-extrabold tracking-[-0.02em]">
            {recommended ? tc(`items.${recommended}.name`) : t("result.noneTitle")}
          </h2>
          {recommended && (
            <span className="font-mono text-sm font-semibold opacity-90">
              {CATEGORY_INFO[recommended].abbreviation}
            </span>
          )}
        </div>
      </div>

      {/* Where you stand: the career map, focused on the result. */}
      <section
        ref={mapRef}
        id="where-you-stand"
        className="flex scroll-mt-24 flex-col gap-4"
        aria-labelledby="ladder-title"
      >
        <h3 id="ladder-title" className="text-xl font-bold tracking-[-0.02em]">
          {t("result.ladder")}
        </h3>
        <CategoryMap markers={markers} result={mapResult} />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-5">
          {target && target !== recommended && <GoalResult target={target} result={mapResult} />}
          {/* Your next move: a short, numbered plan (or what to work on first). */}
          <section
            className={cn(card, "flex flex-col gap-5 p-5 sm:p-6")}
            aria-labelledby="next-move-title"
          >
            <h3 id="next-move-title" className="inline-flex items-center gap-2 text-base font-bold">
              <Sparkles className="size-4 text-link" aria-hidden />
              {t("guide.title")}
            </h3>
            {recommended ? (
              <ol className="flex flex-col gap-4">
                {(["account", "documents", "apply"] as const).map((k, i) => (
                  <li
                    key={k}
                    className="flex animate-rise gap-4"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="relative flex flex-col items-center">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold num text-primary-foreground">
                        {i + 1}
                      </span>
                      {i < 2 && <span aria-hidden className="mt-1 w-px flex-1 bg-primary/25" />}
                    </span>
                    <span className="flex flex-col gap-0.5 pb-1">
                      <span className="font-semibold">
                        {t(`guide.${k}.title`, { category: tc(`items.${recommended}.name`) })}
                      </span>
                      <span className="text-sm text-muted-foreground">{t(`guide.${k}.body`)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="flex flex-col gap-2">
                {(blockers.length ? blockers : ["general"]).map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-3 rounded-2xl bg-warning-soft/60 p-3.5 text-sm"
                  >
                    <Clock3 className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">{t(`guide.missing.${b}.title`)}</span>
                      <span className="text-muted-foreground">{t(`guide.missing.${b}.body`)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {next?.experience && yearsLeft > 0 && (
              <p className="flex items-start gap-2 rounded-2xl bg-ember-soft/50 p-3.5 text-sm">
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-ember-text" aria-hidden />
                {t("guide.upgrade", {
                  years: yearsLeft,
                  category: tc(`items.${next.category}.name`),
                })}
              </p>
            )}
          </section>

          {next?.experience && (
            <div className={cn(card, "p-5")}>
              <Meter
                label={t("result.towards", { category: tc(`items.${next.category}.name`) })}
                value={next.experience.years}
                max={next.experience.required}
                target={next.experience.required}
                tone="ember"
                valueText={t("result.yearsOf", {
                  years: next.experience.years,
                  required: next.experience.required,
                })}
              />
            </div>
          )}

          {/* Documents: a checklist you can tick off. */}
          {recommended && (
            <section
              className={cn(card, "flex flex-col gap-4 p-5 sm:p-6")}
              aria-labelledby="prepare-title"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3
                  id="prepare-title"
                  className="inline-flex items-center gap-2 text-base font-bold"
                >
                  <FileText className="size-4 text-link" aria-hidden />
                  {t("result.prepare")}
                </h3>
                <span className="text-xs font-semibold num text-muted-foreground">
                  {t("result.ready", { ready: ready.size, total: docs.length })}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.08] dark:bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--sky))] transition-[width] duration-(--dur-4) ease-(--ease-enter)"
                  style={{ width: `${(ready.size / Math.max(1, docs.length)) * 100}%` }}
                />
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {docs.map((doc, i) => {
                  const on = ready.has(doc);
                  return (
                    <li
                      key={doc}
                      className="animate-rise"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl p-3 text-sm font-medium transition-colors",
                          on
                            ? "bg-success-soft text-foreground"
                            : "bg-foreground/[0.04] hover:bg-foreground/[0.07] dark:bg-white/[0.04]",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(doc)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "inline-flex size-5 shrink-0 items-center justify-center rounded-md transition-[background-color,box-shadow] peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/40",
                            on
                              ? "bg-success text-white"
                              : "bg-card shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--foreground)_25%,transparent)] dark:bg-white/[0.06]",
                          )}
                        >
                          {on && <Check className="size-3.5 animate-pop" />}
                        </span>
                        <span className={cn(on && "line-through decoration-foreground/30")}>
                          {td(doc)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {/* Next steps (sticky on desktop). */}
        <aside className={cn(card, "flex flex-col gap-4 p-5 sm:p-6 lg:sticky lg:top-24")}>
          <h3 className="text-base font-bold">{t("result.nextSteps")}</h3>
          <Link
            href="/sign-up"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
          >
            {t("result.start")}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={share}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground/[0.05] text-sm font-semibold transition-colors hover:bg-foreground/[0.09] dark:bg-white/[0.06]"
            >
              {shared ? <Check className="size-4 text-success" /> : <Share2 className="size-4" />}
              {shared ? t("result.copied") : t("result.share")}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground/[0.05] text-sm font-semibold transition-colors hover:bg-foreground/[0.09] dark:bg-white/[0.06]"
            >
              <PenLine className="size-4" />
              {t("result.edit")}
            </button>
          </div>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-link hover:underline"
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("result.restart")}
          </button>
          {eligible.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-foreground/[0.07] pt-4">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("result.eligibleFor")}
              </span>
              <div className="flex flex-wrap gap-1.5" aria-label={t("result.eligibleFor")}>
                {eligible.map((r) => (
                  <StatusBadge
                    key={r.category}
                    tone="good"
                    label={CATEGORY_INFO[r.category].abbreviation}
                  />
                ))}
              </div>
            </div>
          )}
          <p className="border-t border-foreground/[0.07] pt-4 text-xs text-muted-foreground">
            {t("disclaimer")}
          </p>
        </aside>
      </div>
    </div>
  );
}

/**
 * The moment of the result: a full dialog that congratulates (confetti, the cheering
 * companion, the category) or encourages (not yet, what to work on), then hands over to the map.
 * It continues on its own after a few seconds (a bar shows the countdown; hovering pauses it).
 */
function Celebration({
  open,
  recommended,
  blockers,
  onContinue,
}: {
  open: boolean;
  recommended: Category | null;
  blockers: string[];
  onContinue: () => void;
}) {
  const t = useTranslations("eligibility");
  const tc = useTranslations("categories");
  const [paused, setPaused] = useState(false);
  const win = Boolean(recommended);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onContinue()}>
      <DialogContent
        className="gap-0 overflow-hidden border-0 p-0 sm:max-w-md sm:p-0"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        <div
          className={cn(
            "relative isolate flex flex-col items-center gap-3 overflow-hidden px-6 pt-8 pb-6 text-center",
            win
              ? "bg-[linear-gradient(160deg,color-mix(in_oklch,var(--primary)_14%,var(--card)),var(--card))]"
              : "bg-[linear-gradient(160deg,color-mix(in_oklch,var(--sun)_16%,var(--card)),var(--card))]",
          )}
        >
          {win && (
            <div aria-hidden data-loop className="pointer-events-none absolute inset-0 -z-10">
              {Array.from({ length: 22 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "celebrate-piece absolute top-0 block h-2.5 w-1.5 rounded-[2px]",
                    ["bg-primary", "bg-sun", "bg-ember", "bg-sky"][i % 4],
                  )}
                  style={{
                    left: `${(i * 37) % 100}%`,
                    animationDelay: `${(i % 7) * 0.35}s`,
                    animationDuration: `${2.6 + (i % 5) * 0.35}s`,
                  }}
                />
              ))}
            </div>
          )}
          <EligibilityPerson
            mood={win ? "happy" : "hopeful"}
            className="w-44 animate-pop sm:w-52"
          />
          <DialogTitle className="text-[clamp(1.5rem,1.2rem+1.4vw,2rem)] leading-tight font-extrabold tracking-[-0.02em]">
            {win ? t("celebrate.winTitle") : t("celebrate.notYetTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {win ? t("celebrate.winBody") : t("celebrate.notYetBody")}
          </DialogDescription>
          {win ? (
            <span className="inline-flex animate-pop items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-[0_12px_26px_-12px_oklch(0.45_0.2_264/0.8)]">
              <span className="font-mono">{CATEGORY_INFO[recommended!].section}</span>
              {tc(`items.${recommended!}.name`)}
            </span>
          ) : (
            blockers.length > 0 && (
              <span className="flex flex-wrap justify-center gap-1.5">
                {blockers.map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning"
                  >
                    {t(`guide.missing.${b}.title`)}
                  </span>
                ))}
              </span>
            )
          )}
        </div>
        <div className="flex flex-col gap-3 p-5">
          <button
            type="button"
            onClick={onContinue}
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
          >
            {t("celebrate.continue")}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </button>
          {/* Auto-continue countdown. */}
          <span aria-hidden className="h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
            <span
              className="block h-full origin-left rounded-full bg-[linear-gradient(90deg,var(--primary),var(--sky))]"
              style={{
                animation: "celebrate-countdown 7s linear both",
                animationPlayState: paused ? "paused" : "running",
              }}
              // Reduced motion shortens animations to an instant: don't auto-close then.
              onAnimationEnd={() =>
                !window.matchMedia("(prefers-reduced-motion: reduce)").matches && onContinue()
              }
            />
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
