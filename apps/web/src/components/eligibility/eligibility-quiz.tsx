"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Cake,
  GraduationCap,
  Minus,
  Plus,
  RotateCcw,
  Share2,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CATEGORY_INFO,
  EDUCATION_LEVELS,
  HELD_LICENCES,
  PRECHECK_DOCUMENTS,
  precheck,
  type PrecheckAnswers,
} from "@rebp/contracts";
import { CategoryLadder, type LadderMarker } from "@/components/categories/category-ladder";
import { Meter } from "@/components/data/meter";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type Step = "who" | "age" | "education" | "licence" | "years" | "result";

const INITIAL: PrecheckAnswers = {
  applicantType: "INDIVIDUAL",
  adult: true,
  education: "A2",
  licence: "NONE",
  years: 0,
};

/**
 * "Am I eligible?" (FR-PORTAL-006): one question per screen (GOV.UK pattern), big tappable
 * answers that advance on tap, then a visual result — the recommended category on the
 * ladder, experience progress as a meter, and the documents to prepare. Indicative only.
 */
export function EligibilityQuiz() {
  const t = useTranslations("eligibility");
  const tc = useTranslations("categories");
  const [answers, setAnswers] = useState<PrecheckAnswers>(INITIAL);
  const [history, setHistory] = useState<Step[]>(["who"]);
  const step = history[history.length - 1]!;

  const flow: Step[] =
    answers.applicantType === "ORGANISATION"
      ? ["who", "result"]
      : answers.licence === "NONE"
        ? ["who", "age", "education", "licence", "result"]
        : ["who", "age", "education", "licence", "years", "result"];
  const position = Math.max(0, flow.indexOf(step));

  const go = (next: Step) => setHistory((h) => [...h, next]);
  const answer = (patch: Partial<PrecheckAnswers>, next: Step) => {
    setAnswers((a) => ({ ...a, ...patch }));
    go(next);
  };
  const back = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const restart = () => {
    setAnswers(INITIAL);
    setHistory(["who"]);
  };

  return (
    <div className="flex flex-col gap-6">
      {step !== "result" && (
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={back}
            disabled={history.length === 1}
            aria-label={t("back")}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div
            className="flex flex-1 gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={flow.length - 1}
            aria-valuenow={position + 1}
            aria-label={t("progress", { step: position + 1, total: flow.length - 1 })}
          >
            {flow.slice(0, -1).map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-(--dur-3)",
                  i <= position ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Keyed by step so each question animates in. */}
      <div key={step} className="animate-rise">
        {step === "who" && (
          <Question title={t("q.who")}>
            <Option
              icon={User}
              label={t("a.individual")}
              onClick={() => answer({ applicantType: "INDIVIDUAL" }, "age")}
            />
            <Option
              icon={Building2}
              label={t("a.firm")}
              onClick={() => answer({ applicantType: "ORGANISATION" }, "result")}
            />
          </Question>
        )}
        {step === "age" && (
          <Question title={t("q.age")}>
            <Option
              icon={Cake}
              label={t("a.yes")}
              onClick={() => answer({ adult: true }, "education")}
            />
            <Option
              icon={Cake}
              label={t("a.no")}
              onClick={() => answer({ adult: false }, "education")}
            />
          </Question>
        )}
        {step === "education" && (
          <Question title={t("q.education")}>
            {EDUCATION_LEVELS.map((level) => (
              <Option
                key={level}
                icon={GraduationCap}
                label={t(`educationLevels.${level}`)}
                onClick={() => answer({ education: level }, "licence")}
              />
            ))}
          </Question>
        )}
        {step === "licence" && (
          <Question title={t("q.licence")}>
            {HELD_LICENCES.map((licence) => (
              <Option
                key={licence}
                icon={BadgeCheck}
                label={licence === "NONE" ? t("a.noLicence") : tc(`items.${licence}.name`)}
                onClick={() =>
                  answer({ licence, years: 0 }, licence === "NONE" ? "result" : "years")
                }
              />
            ))}
          </Question>
        )}
        {step === "years" && (
          <Question
            title={t("q.years", {
              category: CATEGORY_INFO[answers.licence as "FSLA"].abbreviation,
            })}
          >
            <YearsPicker
              value={answers.years}
              onChange={(years) => setAnswers((a) => ({ ...a, years }))}
            />
            <Button size="lg" onClick={() => go("result")} className="mt-2">
              {t("seeResult")} <ArrowRight />
            </Button>
          </Question>
        )}
        {step === "result" && <Result answers={answers} onRestart={restart} />}
      </div>
    </div>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-[clamp(1.4rem,1.2rem+1vw,2rem)] leading-tight font-bold tracking-tight">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Option({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group spotlight flex min-h-16 w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left text-base font-semibold raised transition-[transform,border-color,background-color] duration-(--dur-2) outline-none hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.98] active:bg-primary-soft"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground transition-transform duration-(--dur-3) ease-spring group-hover:scale-110">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex-1">{label}</span>
      <ArrowRight
        className="size-5 text-muted-foreground transition-transform duration-(--dur-2) group-hover:translate-x-1"
        aria-hidden
      />
    </button>
  );
}

function YearsPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useTranslations("eligibility");
  return (
    <div className="flex items-center justify-center gap-6 rounded-3xl border bg-card p-6 raised">
      <Button
        variant="tonal"
        size="icon"
        className="size-14 rounded-2xl"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label={t("fewer")}
      >
        <Minus className="size-6" />
      </Button>
      <output aria-live="polite" className="flex w-24 flex-col items-center">
        <span key={value} className="animate-pop text-6xl font-extrabold num">
          {value}
          {value >= 10 ? "+" : ""}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {t("yearsUnit", { count: value })}
        </span>
      </output>
      <Button
        variant="tonal"
        size="icon"
        className="size-14 rounded-2xl"
        onClick={() => onChange(Math.min(10, value + 1))}
        aria-label={t("more")}
      >
        <Plus className="size-6" />
      </Button>
    </div>
  );
}

function Result({ answers, onRestart }: { answers: PrecheckAnswers; onRestart: () => void }) {
  const t = useTranslations("eligibility");
  const tc = useTranslations("categories");
  const td = useTranslations("eligibility.documents");
  const { results, recommended, next } = precheck(answers);
  const eligible = results.filter((r) => r.status === "eligible");

  const markers: LadderMarker[] = [];
  if (answers.licence !== "NONE") markers.push({ category: answers.licence, kind: "current" });
  if (recommended) markers.push({ category: recommended, kind: "recommended" });
  if (next && next.category !== recommended)
    markers.push({ category: next.category, kind: "next" });

  const share = async () => {
    const text = recommended
      ? t("shareText", { category: tc(`items.${recommended}.name`) })
      : t("title");
    try {
      if (navigator.share)
        await navigator.share({ title: t("title"), text, url: window.location.href });
      else await navigator.clipboard.writeText(`${text} ${window.location.href}`);
    } catch {
      /* the user dismissed the share sheet */
    }
  };

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <div
        className={cn(
          "relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-3xl p-6 text-center sm:p-8",
          recommended ? "bg-brand" : "border bg-card",
        )}
      >
        {recommended && (
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-imigongo text-white opacity-[0.08]"
          />
        )}
        <span
          className={cn(
            "inline-flex size-16 animate-pop items-center justify-center rounded-2xl",
            recommended ? "bg-white/95 text-brand" : "bg-warning-soft text-warning",
          )}
        >
          <BadgeCheck className="size-8" aria-hidden />
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            recommended ? "opacity-90" : "text-muted-foreground",
          )}
        >
          {recommended ? t("result.youCanApply") : t("result.notYet")}
        </span>
        <h2 className="text-[clamp(1.5rem,1.2rem+1.4vw,2.25rem)] font-extrabold">
          {recommended ? tc(`items.${recommended}.name`) : t("result.noneTitle")}
        </h2>
        {recommended && (
          <span className="font-mono text-sm font-semibold opacity-90">
            {CATEGORY_INFO[recommended].section} · {CATEGORY_INFO[recommended].abbreviation}
          </span>
        )}
      </div>

      {next?.experience && (
        <div className="rounded-2xl border bg-card p-5 raised">
          <Meter
            label={t("result.towards", { category: tc(`items.${next.category}.name`) })}
            value={next.experience.years}
            max={next.experience.required}
            target={next.experience.required}
            tone="warning"
            valueText={t("result.yearsOf", {
              years: next.experience.years,
              required: next.experience.required,
            })}
          />
        </div>
      )}

      {eligible.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={t("result.eligibleFor")}>
          {eligible.map((r) => (
            <StatusBadge
              key={r.category}
              tone="good"
              size="lg"
              label={CATEGORY_INFO[r.category].abbreviation}
            />
          ))}
        </div>
      )}

      {recommended && (
        <section className="flex flex-col gap-3" aria-labelledby="prepare-title">
          <h3 id="prepare-title" className="text-base">
            {t("result.prepare")}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {PRECHECK_DOCUMENTS[recommended].map((doc, i) => (
              <li
                key={doc}
                className="flex animate-rise items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm font-medium"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="size-2 rounded-full bg-primary" aria-hidden />
                {td(doc)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="sm:flex-1">
          <Link href="/sign-up">
            {t("result.start")} <ArrowRight />
          </Link>
        </Button>
        <Button size="lg" variant="tonal" onClick={share}>
          <Share2 /> {t("result.share")}
        </Button>
        <Button size="lg" variant="ghost" onClick={onRestart}>
          <RotateCcw /> {t("result.restart")}
        </Button>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="ladder-title">
        <h3 id="ladder-title" className="text-base">
          {t("result.ladder")}
        </h3>
        <CategoryLadder markers={markers} />
      </section>

      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}
