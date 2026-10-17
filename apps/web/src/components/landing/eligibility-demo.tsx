"use client";

import { ArrowRight, Building2, Clock3, Lock, User } from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CATEGORY_INFO,
  EDUCATION_LEVELS,
  HELD_LICENCES,
  precheck,
  type PrecheckAnswers,
} from "@rebp/contracts";
import { EligibilityPerson } from "@/components/eligibility/eligibility-person";
import { TIER_TILE } from "@/components/registry/tones";
import { cn } from "@/lib/utils";

interface Persona {
  name: string;
  age?: number;
  answers: PrecheckAnswers;
}

/** Five example applicants with different outcomes; results come from the real rules. */
const PERSONAS: Persona[] = [
  {
    name: "Aline",
    age: 24,
    answers: {
      applicantType: "INDIVIDUAL",
      adult: true,
      education: "A2",
      licence: "NONE",
      years: 0,
    },
  },
  {
    name: "Eric",
    age: 31,
    answers: {
      applicantType: "INDIVIDUAL",
      adult: true,
      education: "REAL_ESTATE_DEGREE",
      licence: "REA",
      years: 3,
    },
  },
  {
    name: "Divine",
    age: 27,
    answers: {
      applicantType: "INDIVIDUAL",
      adult: true,
      education: "A1_OR_HIGHER",
      licence: "FSLA",
      years: 1,
    },
  },
  {
    name: "Patrick",
    age: 16,
    answers: {
      applicantType: "INDIVIDUAL",
      adult: false,
      education: "A2",
      licence: "NONE",
      years: 0,
    },
  },
  {
    name: "Keza Realty",
    answers: {
      applicantType: "ORGANISATION",
      adult: true,
      education: "A2",
      licence: "NONE",
      years: 0,
    },
  },
];

/** Timing of one question: shown, then the example answer is tapped, then the next. */
const ASK_MS = 1000;
const TAP_MS = 750;
const RESULT_MS = 4600;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

interface Screen {
  title: string;
  options: string[];
  chosen: number;
  years?: number;
}

/**
 * Homepage demo of the eligibility check (FR-PORTAL-006), shown as the real check in a browser
 * window: for each example applicant the questions appear with their real options, the
 * example answer is tapped (a ripple) and the progress bar advances; then the real rules give
 * the verdict: a category (with progress towards the next one when relevant) or "not yet"
 * with what is missing. The companion beside it wonders, then cheers or stays hopeful. Plays
 * only on screen; reduced motion shows the first result. Decorative for screen readers; the
 * link opens the real check.
 */
export function EligibilityDemo() {
  const t = useTranslations("eligibility");
  const tc = useTranslations("categories");
  const tl = useTranslations("landing.demo");
  const [persona, setPersona] = useState(0);
  const [step, setStep] = useState(0);
  const [tapped, setTapped] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );

  const who = PERSONAS[persona]!;
  const a = who.answers;
  const screens: Screen[] =
    a.applicantType === "ORGANISATION"
      ? [{ title: t("q.who"), options: [t("a.individual"), t("a.firm")], chosen: 1 }]
      : [
          { title: t("q.who"), options: [t("a.individual"), t("a.firm")], chosen: 0 },
          { title: t("q.age"), options: [t("a.yes"), t("a.no")], chosen: a.adult ? 0 : 1 },
          {
            title: t("q.education"),
            options: EDUCATION_LEVELS.map((l) => t(`educationLevels.${l}`)),
            chosen: EDUCATION_LEVELS.indexOf(a.education),
          },
          {
            title: t("q.licence"),
            options: HELD_LICENCES.map((l) =>
              l === "NONE" ? t("a.noLicence") : CATEGORY_INFO[l].abbreviation,
            ),
            chosen: HELD_LICENCES.indexOf(a.licence),
          },
          ...(a.licence !== "NONE"
            ? [
                {
                  title: t("q.years", { category: CATEGORY_INFO[a.licence].abbreviation }),
                  options: [],
                  chosen: -1,
                  years: a.years,
                },
              ]
            : []),
        ];
  const { results, recommended, next } = precheck(a);
  const blockers = recommended ? [] : (results.find((r) => r.category === "RERA")?.missing ?? []);
  const atResult = reduced || step >= screens.length;
  const screen = screens[Math.min(step, screens.length - 1)]!;
  const mood = atResult ? (recommended ? "happy" : "hopeful") : "thinking";

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([e]) => setOnScreen(!!e?.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The script: ask → tap → next question … → verdict → next applicant.
  useEffect(() => {
    if (reduced || !onScreen) return;
    const id = setTimeout(
      () => {
        if (step >= screens.length) {
          setStep(0);
          setTapped(false);
          setPersona((p) => (p + 1) % PERSONAS.length);
        } else if (!tapped) setTapped(true);
        else {
          setTapped(false);
          setStep((s) => s + 1);
        }
      },
      step >= screens.length ? RESULT_MS : tapped ? TAP_MS : ASK_MS,
    );
    return () => clearTimeout(id);
  }, [step, tapped, screens.length, onScreen, reduced]);

  return (
    <div
      ref={root}
      data-loop
      className="relative isolate flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6 lg:gap-8"
    >
      {/* The companion. */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <EligibilityPerson
          key={`${mood}-${persona}`}
          mood={mood}
          className="w-52 animate-pop sm:w-56 lg:w-72 xl:w-80"
        />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-[0.7rem] font-semibold text-primary-soft-foreground">
          <span className="relative flex size-1.5" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-ember/70" />
            <span className="relative size-1.5 rounded-full bg-ember" />
          </span>
          {tl("live")}
        </span>
      </div>

      {/* The check, in a browser window (no shadow: a hairline frame). */}
      <div className="flex w-full max-w-md min-w-0 flex-1 flex-col overflow-hidden rounded-[1.6rem] bg-card ring-1 ring-foreground/10 dark:bg-white/[0.04] dark:ring-white/10">
        <div
          aria-hidden
          className="flex items-center gap-3 border-b border-foreground/[0.07] px-4 py-2.5"
        >
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive/60" />
            <span className="size-2.5 rounded-full bg-sun/80" />
            <span className="size-2.5 rounded-full bg-success/60" />
          </span>
          <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-full bg-foreground/[0.05] px-3 py-1 font-mono text-[0.7rem] text-muted-foreground dark:bg-white/[0.06]">
            <Lock className="size-3 shrink-0" />
            rebp.rw/eligibility
          </span>
        </div>

        <div aria-hidden className="flex h-[18.5rem] flex-col gap-2.5 p-4">
          {/* Who is answering. */}
          <div className="flex items-center justify-between gap-3">
            <span
              key={`who-${persona}`}
              className="inline-flex animate-rise items-center gap-2 text-sm font-semibold"
            >
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-soft text-link dark:bg-white/[0.08]">
                {a.applicantType === "ORGANISATION" ? (
                  <Building2 className="size-3.5" />
                ) : (
                  <User className="size-3.5" />
                )}
              </span>
              {who.name}
              {who.age !== undefined && (
                <span className="font-normal text-muted-foreground">· {who.age}</span>
              )}
            </span>
            <span className="flex gap-1">
              {PERSONAS.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-[width,background-color] duration-(--dur-3)",
                    i === persona ? "w-5 bg-primary" : "w-1.5 bg-foreground/15",
                  )}
                />
              ))}
            </span>
          </div>

          {!atResult ? (
            <>
              <div className="flex gap-1">
                {screens.map((_, i) => (
                  <span
                    key={i}
                    className="relative h-1 flex-1 overflow-hidden rounded-full bg-foreground/10"
                  >
                    <span
                      className={cn(
                        "absolute inset-0 origin-left rounded-full bg-[linear-gradient(90deg,var(--primary),var(--sky))] transition-transform duration-500",
                        i < step || (i === step && tapped) ? "scale-x-100" : "scale-x-0",
                      )}
                    />
                  </span>
                ))}
              </div>
              <div
                key={`${persona}-${step}`}
                className="flex animate-rise flex-col gap-2.5 [animation-duration:var(--dur-3)]"
              >
                <span className="text-[0.7rem] font-semibold num text-muted-foreground">
                  {t("progress", { step: step + 1, total: screens.length })}
                </span>
                <span className="text-base leading-tight font-bold">{screen.title}</span>
                {screen.years !== undefined ? (
                  <span className="flex items-center justify-center gap-4 rounded-2xl bg-foreground/[0.04] py-4 dark:bg-white/[0.04]">
                    <span className="text-4xl font-extrabold num">{tapped ? screen.years : 0}</span>
                    <span className="text-sm text-muted-foreground">
                      {t("yearsUnit", { count: tapped ? screen.years : 0 })}
                    </span>
                  </span>
                ) : (
                  <span className={cn("grid gap-1.5", screen.options.length > 2 && "grid-cols-2")}>
                    {screen.options.map((o, i) => {
                      const on = tapped && i === screen.chosen;
                      return (
                        <span
                          key={o}
                          className={cn(
                            "relative flex min-h-9 items-center overflow-hidden rounded-xl px-3 py-1.5 text-[0.75rem] font-medium transition-[background-color,color] duration-300",
                            on
                              ? "bg-primary text-primary-foreground"
                              : "bg-foreground/[0.04] dark:bg-white/[0.05]",
                          )}
                        >
                          {on && (
                            <span className="absolute top-1/2 left-1/2 size-24 -translate-1/2 animate-[demo-tap_700ms_var(--ease-enter)_both] rounded-full bg-white/30" />
                          )}
                          <span className="relative truncate">{o}</span>
                        </span>
                      );
                    })}
                  </span>
                )}
              </div>
            </>
          ) : recommended ? (
            <div key={`result-${persona}`} className="my-auto flex animate-pop flex-col gap-3">
              <span className="text-center text-xl font-extrabold tracking-[-0.02em]">
                {tl("congrats")}
              </span>
              <div className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--primary)_60%,var(--sky)))] p-4 text-primary-foreground dark:bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_45%,oklch(0.2_0.03_265)),oklch(0.19_0.025_265))]">
                <span
                  className={cn(
                    "inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ring-2 ring-white/40",
                    TIER_TILE[CATEGORY_INFO[recommended].tier],
                  )}
                >
                  {CATEGORY_INFO[recommended].section}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs opacity-85">{t("result.youCanApply")}</span>
                  <span className="truncate text-base font-bold">
                    {tc(`items.${recommended}.name`)}
                  </span>
                </span>
              </div>
              {next?.experience && (
                <div className="flex flex-col gap-1.5 rounded-2xl bg-ember-soft/60 p-3">
                  <span className="flex justify-between gap-3 text-xs font-semibold">
                    <span className="truncate">
                      {t("result.towards", {
                        category: CATEGORY_INFO[next.category].abbreviation,
                      })}
                    </span>
                    <span className="shrink-0 num">
                      {t("result.yearsOf", {
                        years: next.experience.years,
                        required: next.experience.required,
                      })}
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <span
                      className="block h-full origin-left animate-[grow-x_900ms_var(--ease-enter)_both] rounded-full bg-ember"
                      style={{
                        width: `${(next.experience.years / next.experience.required) * 100}%`,
                      }}
                    />
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div key={`result-${persona}`} className="my-auto flex animate-pop flex-col gap-3">
              <span className="text-center text-lg font-extrabold tracking-[-0.02em]">
                {t("celebrate.notYetTitle")}
              </span>
              <div className="flex flex-col gap-2.5 rounded-2xl bg-warning-soft/70 p-4">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="size-4 text-warning" />
                  {t("celebrate.notYetBody")}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {blockers.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-warning dark:bg-white/[0.08]"
                    >
                      {t(`guide.missing.${b}.title`)}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.07] px-4 py-2.5">
          <span className="min-w-0 truncate text-xs text-muted-foreground">{tl("footnote")}</span>
          <Link
            href={"/eligibility" as Route}
            className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
          >
            {tl("cta")}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
