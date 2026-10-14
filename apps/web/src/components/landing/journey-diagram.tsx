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
  Wifi,
  type LucideIcon,
} from "@/components/icons";
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

  // The phone leans a little towards the pointer (3D), springing back when it leaves.
  const phone = useRef<HTMLDivElement>(null);
  const tilt = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== "mouse" || !phone.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    phone.current.style.setProperty("--tilt-x", `${(-y * 10).toFixed(2)}deg`);
    phone.current.style.setProperty("--tilt-y", `${(x * 14).toFixed(2)}deg`);
  };
  const untilt = () => {
    phone.current?.style.setProperty("--tilt-x", "0deg");
    phone.current?.style.setProperty("--tilt-y", "0deg");
  };

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
                  selected ? "bg-card" : "hover:bg-card/60",
                )}
              >
                <span
                  className={cn(
                    "relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-(--dur-3)",
                    selected
                      ? "bg-primary text-primary-foreground"
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
        onPointerMove={tilt}
        onPointerLeave={untilt}
        className="relative isolate order-first flex min-h-[25rem] items-center justify-center overflow-hidden rounded-[2rem] bg-surface-2 p-6 lg:order-none dark:bg-white/[0.025]"
      >
        <div aria-hidden className="absolute inset-0 -z-10 bg-ambient dark:opacity-60" />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-40 bg-imigongo-fade text-link opacity-[0.06] dark:opacity-[0.035]"
        />
        <PhoneSketch
          ref={phone}
          stepKey={step.key}
          stepIndex={active}
          total={STEPS.length}
          icon={step.icon}
        >
          {step.key === "account" && <AccountSketch />}
          {step.key === "apply" && <ApplySketch />}
          {step.key === "pay" && <PaySketch />}
          {step.key === "license" && <LicenceSketch />}
        </PhoneSketch>
      </div>
    </div>
  );
}

/** The time shown in the status bar: 9:41 (Apple's) until the page runs, then the real time. */
function useClock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date()
          .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
          .replace(/\s?[AP]M$/i, ""),
      );
    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return now ?? "9:41";
}

/**
 * An iPhone (Pro style), drawn like the real thing and alive:
 * - a thin titanium frame (quiet: low opacity on the dark theme), side buttons, a black bezel;
 * - a status bar (live clock, signal, Wi-Fi, battery), a home indicator, a faint glass glare;
 * - the Dynamic Island opens like a Live Activity for each step (its icon and progress), a light
 *   sheen crosses the glass, the phone floats and leans towards the pointer.
 * Everything moving stops under reduced motion; it is decorative (the tabs carry the meaning).
 */
const PhoneSketch = function PhoneSketch({
  ref,
  children,
  stepKey,
  stepIndex,
  total,
  icon: Icon,
}: {
  ref?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
  stepKey: string;
  stepIndex: number;
  total: number;
  icon: LucideIcon;
}) {
  const time = useClock();
  const side =
    "absolute w-[3px] bg-linear-to-b from-zinc-300 to-zinc-400 dark:from-zinc-500/25 dark:to-zinc-700/25";
  return (
    <div aria-hidden className="[perspective:1100px]">
      <div
        ref={ref}
        data-phone-live
        className="relative w-[14.5rem] animate-float transition-transform duration-500 ease-out [transform-style:preserve-3d]"
        style={{ transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))" }}
      >
        {/* Side buttons: action, volume up/down (left); side button (right). */}
        <span className={cn(side, "top-[5.5rem] -left-[2px] h-6 rounded-l-[2px]")} />
        <span className={cn(side, "top-[8rem] -left-[2px] h-11 rounded-l-[2px]")} />
        <span className={cn(side, "top-[11.25rem] -left-[2px] h-11 rounded-l-[2px]")} />
        <span className={cn(side, "top-[9rem] -right-[2px] h-16 rounded-r-[2px]")} />

        {/* Titanium frame: a soft metallic edge, low opacity on dark. */}
        <div className="rounded-[3rem] bg-linear-to-br from-zinc-300/60 via-zinc-100/50 to-zinc-400/60 p-[2.5px] shadow-[0_30px_60px_-22px_rgb(15_23_42/0.5),0_8px_20px_-12px_rgb(15_23_42/0.25)] dark:from-zinc-400/15 dark:via-zinc-600/10 dark:to-zinc-500/15 dark:shadow-[0_34px_70px_-24px_rgb(0_0_0/0.9)]">
          {/* Black bezel. */}
          <div className="rounded-[calc(3rem-2.5px)] bg-black p-[7px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.04)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.02)]">
            {/* Screen. */}
            <div className="relative h-[28rem] overflow-hidden rounded-[2.45rem] bg-background dark:bg-[oklch(0.145_0.012_268)]">
              {/* Status bar. */}
              <div className="absolute inset-x-0 top-0 z-20 flex h-10 items-center justify-between px-3.5 text-[0.62rem] font-semibold num text-foreground">
                <span className="w-11 text-center tracking-tight">{time}</span>
                <span className="flex w-11 items-center justify-end gap-[2px]">
                  <span className="flex items-end gap-[1px]">
                    {[3, 5, 7, 9].map((h) => (
                      <span
                        key={h}
                        className="w-[2px] rounded-[1px] bg-foreground"
                        style={{ height: h }}
                      />
                    ))}
                  </span>
                  <Wifi className="size-2.5" strokeWidth={3} />
                  <span className="relative flex h-[0.55rem] w-[1rem] items-center rounded-[3px] border border-foreground/45 p-[1.5px]">
                    <span className="h-full w-[78%] rounded-[1.5px] bg-foreground" />
                    <span className="absolute top-1/2 -right-[3px] h-1 w-[1.5px] -translate-y-1/2 rounded-r-full bg-foreground/45" />
                  </span>
                </span>
              </div>

              {/* Dynamic Island: opens as a Live Activity for each step, then settles. */}
              <div
                key={`island-${stepKey}`}
                data-phone-live
                className="absolute top-2.5 left-1/2 z-30 flex h-[1.45rem] w-[5.25rem] -translate-x-1/2 animate-[island-live_2.4s_var(--ease-spring)_both] items-center justify-between overflow-hidden rounded-full bg-black px-1.5"
              >
                <span
                  data-phone-live
                  className="flex animate-[island-content_2.4s_ease_both] items-center gap-1.5 opacity-0"
                >
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="size-2.5" strokeWidth={2.5} />
                  </span>
                </span>
                <span
                  data-phone-live
                  className="flex animate-[island-content_2.4s_ease_both] items-center gap-[2px] pr-0.5 opacity-0"
                >
                  {Array.from({ length: total }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "size-[4px] rounded-full",
                        i <= stepIndex ? "bg-success" : "bg-white/25",
                      )}
                    />
                  ))}
                </span>
              </div>

              {/* The step's screen. */}
              <div key={stepKey} className="flex h-full animate-pop flex-col gap-3 px-4 pt-12 pb-8">
                {children}
              </div>

              {/* Home indicator. */}
              <span className="absolute bottom-2 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-foreground/35" />

              {/* Glass: a faint static glare and a sheen that crosses it when the screen changes. */}
              <span className="pointer-events-none absolute inset-0 z-10 bg-linear-to-br from-white/[0.07] via-transparent to-transparent dark:from-white/[0.04]" />
              <span
                key={`sheen-${stepKey}`}
                data-phone-live
                className="pointer-events-none absolute -inset-y-10 left-0 z-10 w-1/3 animate-[glass-sheen_1.4s_var(--ease-enter)_both] bg-linear-to-r from-transparent via-white/[0.12] to-transparent dark:via-white/[0.06]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
      <ProgressRing value={3} total={4} tone="ember" className="size-12" thickness={3}>
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
