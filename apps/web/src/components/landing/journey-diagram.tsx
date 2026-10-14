"use client";

import {
  BadgeCheck,
  Check,
  CreditCard,
  FileText,
  Mail,
  Pause,
  Play,
  Smartphone,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ProgressRing } from "@/components/data/progress-ring";
import { cn } from "@/lib/utils";

const STEPS: { key: "account" | "apply" | "pay" | "license"; icon: LucideIcon }[] = [
  { key: "account", icon: UserPlus },
  { key: "apply", icon: FileText },
  { key: "pay", icon: CreditCard },
  { key: "license", icon: BadgeCheck },
];

const STEP_MS = 4500;

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/**
 * "How it works" as an interactive diagram: four steps (an ARIA tablist with arrow keys), each
 * with an animated sketch of the screen the applicant will see. Auto-advances with a progress
 * fill (Apple product-page pattern) once, with a pause/play toggle (WCAG 2.2.2); hover/focus pause it, picking a step stops it, and it never autoplays under reduced
 * motion. The illustrations are decorative; the tab and panel text carry the meaning.
 */
export function JourneyDiagram() {
  const t = useTranslations("landing");
  const id = useId();
  const [active, setActive] = useState(0);
  // WCAG 2.2.2: autoplay runs once, stops when the user takes over, and has a visible toggle.
  const [stopped, setStopped] = useState(false);
  const [hovering, setHovering] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const autoplay = !reduced && !stopped && !hovering;

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => {
      if (active === STEPS.length - 1)
        setStopped(true); // one full cycle, then rest
      else setActive(active + 1);
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [active, autoplay]);

  const select = (index: number, focus = false) => {
    setStopped(true); // the user is in control now
    setActive(index);
    if (focus) tabs.current[index]?.focus();
  };
  const togglePlay = () => {
    if (stopped && active === STEPS.length - 1) setActive(0);
    setStopped((value) => !value);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = STEPS.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? active === last
          ? 0
          : active + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? active === 0
            ? last
            : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  };

  const step = STEPS[active]!;

  return (
    <div
      className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={() => setHovering(false)}
    >
      <div className="flex flex-col gap-3">
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label={t("stepsTitle")}
          className="flex flex-col gap-2"
          onKeyDown={onKeyDown}
        >
          {STEPS.map(({ key, icon: Icon }, index) => {
            const selected = index === active;
            return (
              <button
                key={key}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${key}`}
                aria-selected={selected}
                aria-controls={`${id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(index)}
                className={cn(
                  "group spotlight relative flex items-center gap-4 overflow-hidden rounded-2xl border p-4 text-left transition-[background-color,border-color,box-shadow] duration-(--dur-3) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  selected
                    ? "border-primary/30 bg-card raised"
                    : "border-transparent hover:bg-card/60",
                )}
              >
                <span
                  className={cn(
                    "relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-(--dur-3)",
                    selected
                      ? "bg-primary btn-gloss text-primary-foreground"
                      : "bg-primary-soft text-primary-soft-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-sun text-[0.65rem] font-bold num text-sun-foreground">
                    {index + 1}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">{t(`steps.${key}.title`)}</span>
                  <span
                    className={cn(
                      "text-sm text-muted-foreground transition-[opacity] duration-(--dur-3)",
                      selected ? "opacity-100" : "line-clamp-1 opacity-70",
                    )}
                  >
                    {t(`steps.${key}.body`)}
                  </span>
                </span>
                {/* Autoplay progress: fills over the step's duration. */}
                {selected && autoplay && (
                  <span
                    aria-hidden
                    key={`${active}-progress`}
                    className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
                    style={{ animation: `step-fill ${STEP_MS}ms linear both` }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {!reduced && (
          <button
            type="button"
            data-autoplay-toggle
            onClick={togglePlay}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-9"
          >
            {stopped ? (
              <Play className="size-4" aria-hidden />
            ) : (
              <Pause className="size-4" aria-hidden />
            )}
            {stopped ? t("journey.play") : t("journey.pause")}
          </button>
        )}
      </div>

      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${step.key}`}
        className="relative isolate order-first flex min-h-[25rem] items-center justify-center overflow-hidden rounded-[2rem] border bg-surface-2 p-6 lg:order-none"
      >
        <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-40 bg-imigongo-fade text-primary opacity-[0.06]"
        />
        <PhoneSketch key={step.key}>
          {step.key === "account" && <AccountSketch />}
          {step.key === "apply" && <ApplySketch />}
          {step.key === "pay" && <PaySketch />}
          {step.key === "license" && <LicenceSketch />}
        </PhoneSketch>
      </div>
    </div>
  );
}

/** A phone outline drawn in the brand's line style; the screen content animates in. */
function PhoneSketch({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="relative w-56 animate-pop rounded-[2.25rem] border-[3px] border-foreground/80 bg-card p-3 shadow-3"
    >
      <span className="mx-auto mb-3 block h-1.5 w-16 rounded-full bg-foreground/20" />
      <div className="flex h-80 flex-col gap-3 overflow-hidden rounded-[1.5rem] bg-background p-4">
        {children}
      </div>
    </div>
  );
}

function Bar({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <span
      className={cn(
        "block h-2.5 origin-left animate-[meter-in_700ms_var(--ease-enter)_both] rounded-full bg-muted",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function Tick({ delay }: { delay: number }) {
  return (
    <span
      className="inline-flex size-6 animate-pop items-center justify-center rounded-full bg-success text-card"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  );
}

function AccountSketch() {
  return (
    <>
      <span className="inline-flex size-12 animate-pop items-center justify-center self-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
        <UserPlus className="size-6" />
      </span>
      <Bar className="mx-auto w-2/3 bg-foreground/15" delay={100} />
      {[0, 1, 2].map((i) => (
        <span key={i} className="flex h-10 items-center rounded-xl border px-3">
          <Bar className="w-3/4 bg-primary/25" delay={300 + i * 250} />
        </span>
      ))}
      <div className="mt-1 flex flex-col gap-2">
        {[Mail, Smartphone].map((Icon, i) => (
          <span
            key={i}
            className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-success"
          >
            <Icon className="size-4" />
            <Bar className="flex-1 bg-success/30" delay={1100 + i * 300} />
            <Tick delay={1300 + i * 300} />
          </span>
        ))}
      </div>
    </>
  );
}

function ApplySketch() {
  return (
    <>
      <div className="flex items-center gap-3">
        <ProgressRing value={4} total={5} className="size-14">
          <span className="text-xs font-bold num">80%</span>
        </ProgressRing>
        <div className="flex flex-1 flex-col gap-2">
          <Bar className="w-full bg-foreground/15" />
          <Bar className="w-1/2 bg-foreground/10" delay={100} />
        </div>
      </div>
      <ol className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="flex items-center gap-2.5 rounded-xl border px-3 py-2">
            {i < 4 ? (
              <Tick delay={250 + i * 220} />
            ) : (
              <span className="size-6 rounded-full border-2 border-dashed border-primary/50" />
            )}
            <Bar
              className={cn("flex-1", i < 4 ? "bg-foreground/15" : "bg-primary/25")}
              delay={150 + i * 120}
            />
          </li>
        ))}
      </ol>
    </>
  );
}

function PaySketch() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <span className="relative inline-flex size-16 items-center justify-center rounded-2xl bg-sun text-sun-foreground">
        <Smartphone className="size-8" />
        <span className="absolute -inset-2 animate-pulse-ring rounded-[1.25rem] text-sun" />
      </span>
      <Bar className="w-3/4 bg-foreground/15" delay={100} />
      <div className="flex gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="size-3.5 animate-pop rounded-full bg-primary"
            style={{ animationDelay: `${500 + i * 280}ms` }}
          />
        ))}
      </div>
      <ProgressRing value={3} total={4} tone="warning" className="size-12" thickness={3}>
        <span className="text-[0.65rem] font-bold num">0:45</span>
      </ProgressRing>
    </div>
  );
}

function LicenceSketch() {
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="relative flex aspect-[1.586] flex-col justify-between overflow-hidden rounded-2xl bg-brand p-3">
        <div aria-hidden className="absolute inset-0 bg-imigongo text-white opacity-[0.07]" />
        <div className="relative flex items-start justify-between">
          <Bar className="w-14 bg-white/40" />
          <span className="inline-flex animate-pop items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-brand [animation-delay:900ms]">
            <Check className="size-3" strokeWidth={3} />
          </span>
        </div>
        <div className="relative flex items-end justify-between">
          <div className="flex flex-col gap-1.5">
            <Bar className="w-16 bg-white/60" delay={200} />
            <Bar className="w-10 bg-white/35" delay={300} />
          </div>
          <span className="relative grid size-12 grid-cols-4 gap-0.5 overflow-hidden rounded-lg bg-white p-1">
            {Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className={cn("rounded-[1px]", (i * 7) % 3 ? "bg-foreground" : "bg-transparent")}
              />
            ))}
            <span className="absolute inset-x-0.5 top-0.5 h-0.5 animate-scan-beam rounded-full bg-sky shadow-[0_0_8px_2px] shadow-sky/70 [--beam-travel:2.5rem]" />
          </span>
        </div>
      </div>
      <span className="flex items-center gap-2 self-center rounded-full bg-success-soft px-3 py-1.5 text-success">
        <BadgeCheck className="size-4" />
        <Bar className="w-16 bg-success/30" delay={600} />
      </span>
    </div>
  );
}
