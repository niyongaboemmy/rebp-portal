"use client";

import {
  ArrowRight,
  BadgeCheck,
  Check,
  CreditCard,
  FileText,
  Mail,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Wifi,
  type LucideIcon,
} from "@/components/icons";
import { useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ProgressRing } from "@/components/data/progress-ring";
import { cn } from "@/lib/utils";

type StepKey = "account" | "apply" | "pay" | "license";

/**
 * The four steps. Each gives the phone its own 3D pose (deg) and the stage its glow, so the
 * picture moves as the reader scrolls: blue, sky, Sun, then blue again for the licence.
 */
const STEPS: {
  key: StepKey;
  icon: LucideIcon;
  /** Where the step happens in the portal (signed-out visitors are sent to sign in first). */
  href: Route;
  pose: { x: number; y: number; z: number };
  glow: string;
}[] = [
  {
    key: "account",
    icon: UserPlus,
    href: "/sign-up",
    pose: { x: 6, y: -16, z: -2 },
    glow: "bg-primary/30",
  },
  {
    key: "apply",
    icon: FileText,
    href: "/applications",
    pose: { x: 4, y: 12, z: 2 },
    glow: "bg-sky/30",
  },
  {
    key: "pay",
    icon: CreditCard,
    href: "/applications",
    pose: { x: 8, y: -8, z: -1 },
    glow: "bg-sun/30",
  },
  {
    key: "license",
    icon: BadgeCheck,
    href: "/licenses",
    pose: { x: 2, y: 4, z: 0 },
    glow: "bg-primary/35",
  },
];

/** While a step is active its scene replays this often, so the phone never goes still. */
const SCENE_MS = 5500;

/** After a click or key press, scroll-tracking waits this long so the jump doesn't fight it. */
const LOCK_MS = 900;

const REDUCED = "(prefers-reduced-motion: reduce)";
const LG = "(min-width: 64rem)";
function subscribeMedia(callback: () => void) {
  const queries = [window.matchMedia(REDUCED), window.matchMedia(LG)];
  for (const query of queries) query.addEventListener("change", callback);
  return () => queries.forEach((query) => query.removeEventListener("change", callback));
}

/**
 * "How it works" as scroll-driven storytelling (Apple product-page pattern). The steps scroll
 * on the left while the phone stays pinned on the right (on top below lg): whichever step
 * crosses the reading line becomes active, and the phone turns to a new pose, slides in that
 * step's screen, drops a notification and opens its Dynamic Island. A rail fills as you go.
 *
 * The steps are an ordered list; each ends with a gradient-outline link to where that step
 * happens in the portal. Clicking a step (or focusing its link) scrolls it to the reading line.
 * The step only changes when the reader scrolls or picks one. While a step is active and the
 * section is on screen, its decorative phone scene replays every few seconds so it stays alive
 * (design choice; there is no pause control, see ADR-009). Reduced motion stops the replays and
 * drops the movement.
 */
export function JourneyDiagram() {
  const t = useTranslations("landing");
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const locked = useRef(false);
  const unlock = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduced = useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia(REDUCED).matches,
    () => true,
  );
  const wide = useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia(LG).matches,
    () => true,
  );
  // The reading line: mid-screen beside the pinned phone; lower below lg, under the stage.
  const line = wide ? 0.5 : 0.74;

  useEffect(() => {
    const margin = `-${line * 100}% 0px -${(1 - line) * 100 - 0.1}% 0px`;
    const observer = new IntersectionObserver(
      (entries) => {
        if (locked.current) return;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = items.current.indexOf(entry.target as HTMLLIElement);
          if (index >= 0) setActive(index);
        }
      },
      { rootMargin: margin },
    );
    for (const item of items.current) if (item) observer.observe(item);
    return () => observer.disconnect();
  }, [line]);

  const select = (index: number) => {
    if (index === active) return;
    locked.current = true;
    clearTimeout(unlock.current);
    unlock.current = setTimeout(() => {
      locked.current = false;
    }, LOCK_MS);
    setActive(index);
    const item = items.current[index];
    if (!item) return;
    const box = item.getBoundingClientRect();
    window.scrollTo({
      top: window.scrollY + box.top + box.height / 2 - window.innerHeight * line,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  // Replay the active step's scene on a loop (island, notification, ticks, chip…).
  // Only while the section is on screen: no work, and no surprise replays, elsewhere.
  const [cycle, setCycle] = useState(0);
  const [onScreen, setOnScreen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(!!entry?.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (reduced || !onScreen) return;
    const timer = setInterval(() => setCycle((c) => c + 1), SCENE_MS);
    return () => clearInterval(timer);
  }, [active, reduced, onScreen]);

  // Progress thread: span it between the first and last numbers and fill it to the reading line.
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const node = list.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const nodes = node.querySelectorAll<HTMLElement>("[data-rail-node]");
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      const box = node.getBoundingClientRect();
      const a = first.getBoundingClientRect();
      const b = last.getBoundingClientRect();
      const top = a.top + a.height / 2 - box.top;
      const height = b.top + b.height / 2 - box.top - top;
      const reading = window.innerHeight * line - (box.top + top);
      node.style.setProperty("--rail-top", `${top}px`);
      node.style.setProperty("--rail-height", `${height}px`);
      node.style.setProperty(
        "--rail-progress",
        Math.min(1, Math.max(0, reading / height)).toFixed(4),
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [line]);

  const step = STEPS[active]!;

  return (
    <div ref={root} data-loop className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
      {/* Stage: pinned while the steps scroll. */}
      <div className="sticky top-16 z-20 -mx-4 bg-sunken px-4 pb-2 sm:-mx-6 sm:px-6 lg:top-[max(5rem,calc(50svh-18rem))] lg:order-last lg:mx-0 lg:h-fit lg:bg-transparent lg:p-0">
        <div
          aria-hidden
          data-step={step.key}
          className="relative isolate flex h-[21rem] items-center justify-center overflow-hidden rounded-[2rem] bg-surface-2 sm:h-[26rem] md:h-[28rem] lg:h-[min(36rem,calc(100svh-7rem))] dark:bg-white/[0.025] [@media(max-height:700px)]:h-[17rem] lg:[@media(max-height:700px)]:h-[min(36rem,calc(100svh-7rem))]"
        >
          <Stage step={step} index={active} cycle={cycle} chip={t(`journey.chips.${step.key}`)} />
        </div>
      </div>

      {/* Steps: each one tall enough to own the reading line for a while. */}
      <ol ref={list} aria-label={t("stepsTitle")} className="relative flex flex-col lg:py-[6svh]">
        {/*
          Progress thread: a faint dotted track from the first number to the last. As the page
          scrolls, the dots fill continuously (blue to sky; a Sun tip on dark) up to the reading
          line, and a glowing bead rides the tip. Scroll-linked, so it is meaningful (and still)
          without motion.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[1.1875rem] w-1 -translate-x-[1px]"
          style={{ top: "var(--rail-top, 0px)", height: "var(--rail-height, 0px)" }}
        >
          <span className="absolute inset-0 text-foreground/15 [background:radial-gradient(circle,currentColor_1.5px,transparent_2px)_center_top/4px_10px_repeat-y] dark:text-white/15" />
          <span
            className="absolute inset-x-0 top-0 bg-[linear-gradient(to_bottom,var(--primary),var(--sky))] [mask:radial-gradient(circle,#000_1.6px,transparent_2.1px)_center_top/4px_10px_repeat-y] dark:bg-[linear-gradient(to_bottom,var(--primary),var(--sky)_60%,var(--sun))]"
            style={{ height: "calc(var(--rail-progress, 0) * 100%)" }}
          />
          <span
            className="absolute left-1/2 size-0 -translate-x-1/2"
            style={{ top: "calc(var(--rail-progress, 0) * 100%)" }}
          >
            <span className="absolute -top-10 left-1/2 h-10 w-1 -translate-x-1/2 rounded-full bg-linear-to-b from-transparent to-sky/70 blur-[1px]" />
            <span className="absolute -top-2.5 -left-2.5 size-5 animate-pulse-ring rounded-full text-sky" />
            <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-white shadow-[0_0_0_3px_var(--sky),0_0_14px_4px_color-mix(in_oklch,var(--sky)_70%,transparent)]" />
          </span>
        </span>
        {STEPS.map(({ key, href }, index) => {
          const selected = index === active;
          const done = index < active;
          return (
            <li
              key={key}
              ref={(node) => {
                items.current[index] = node;
              }}
              aria-current={selected ? "step" : undefined}
              onClick={() => select(index)}
              onFocus={() => select(index)}
              className="group relative flex min-h-[40svh] cursor-pointer items-center sm:min-h-[44svh] lg:min-h-[58svh]"
            >
              <div className="flex items-start gap-4 sm:gap-5">
                <span
                  aria-hidden
                  data-rail-node
                  className={cn(
                    "relative z-10 mt-[1.1rem] inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold num transition-[background-color,color,transform] duration-(--dur-4) ease-spring sm:mt-5",
                    selected && "scale-110 bg-primary text-primary-foreground",
                    done && "bg-primary-soft text-link",
                    !selected &&
                      !done &&
                      "bg-surface-2 text-muted-foreground dark:bg-[oklch(0.21_0.02_265)]",
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : index + 1}
                  {selected && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/30 [animation-iteration-count:2]" />
                  )}
                </span>
                <div
                  className={cn(
                    "flex max-w-md min-w-0 flex-col gap-2 transition-transform duration-(--dur-4) ease-(--ease-enter)",
                    selected ? "translate-x-0" : "translate-x-[-2px]",
                  )}
                >
                  <span className="font-mono text-xs font-semibold tracking-widest text-link">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {/* Inactive steps recede by colour, not opacity, so text keeps AA contrast. */}
                  <h3
                    className={cn(
                      "text-lg font-semibold tracking-tight transition-colors duration-(--dur-4) sm:text-2xl",
                      selected
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {t(`steps.${key}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground sm:text-base">
                    {t(`steps.${key}.body`)}
                  </p>
                  {/*
                  Action with a living outline: a faint blue-sky-Sun hairline, with a bright
                  three-colour beam travelling round it, and blue text. Hover fills it solid
                  blue (outline included) with white text.
                */}
                  <Link
                    href={href}
                    onClick={(event) => event.stopPropagation()}
                    className="group/cta mt-2 inline-flex w-fit animate-search-beam rounded-full p-[1.5px] outline-none [background:conic-gradient(from_var(--beam-angle),transparent_0_58%,var(--primary)_72%,var(--sky)_84%,var(--sun)_95%,transparent_100%),linear-gradient(110deg,color-mix(in_oklch,var(--primary)_28%,transparent),color-mix(in_oklch,var(--sky)_28%,transparent),color-mix(in_oklch,var(--sun)_28%,transparent))] hover:[background:var(--primary)] focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.97]"
                  >
                    <span className="inline-flex h-10 items-center gap-2.5 rounded-full bg-sunken pr-1.5 pl-4 text-sm font-semibold text-link transition-colors duration-(--dur-2) group-hover/cta:bg-primary group-hover/cta:text-primary-foreground sm:h-9 sm:pr-1">
                      {t(`journey.cta.${key}`)}
                      {/*
                        Arrow chip: nudges forward at rest; on hover the arrow flies out to the
                        right and a fresh one slides in from the left.
                      */}
                      <span
                        aria-hidden
                        className="relative inline-flex size-7 items-center justify-center overflow-hidden rounded-full bg-primary-soft transition-colors duration-(--dur-2) group-hover/cta:bg-white/20 sm:size-6.5"
                      >
                        <ArrowRight className="size-3.5 animate-arrow-nudge transition-transform duration-300 ease-(--ease-enter) group-hover/cta:translate-x-[160%] group-hover/cta:animate-none" />
                        <ArrowRight className="absolute size-3.5 -translate-x-[160%] transition-transform duration-300 ease-(--ease-enter) group-hover/cta:translate-x-0 group-hover/cta:delay-75" />
                      </span>
                    </span>
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The stage behind the phone: a glow in the step's colour, a giant faint step number, a slow
 * ring, the phone itself and one glass chip that lands beside it.
 */
function Stage({
  step,
  index,
  cycle,
  chip,
}: {
  step: (typeof STEPS)[number];
  index: number;
  cycle: number;
  chip: string;
}) {
  const Icon = step.icon;
  return (
    <>
      <div aria-hidden className="absolute inset-0 -z-10 bg-ambient dark:opacity-60" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-40 bg-imigongo-fade text-link opacity-[0.06] dark:opacity-[0.035]"
      />
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-1/2 -z-10 size-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-colors duration-1000",
          step.glow,
        )}
      />
      <span
        key={`num-${step.key}`}
        aria-hidden
        className="absolute -right-2 -bottom-10 -z-10 animate-rise font-display text-[13rem] leading-none font-black tracking-tight text-foreground/[0.04] select-none dark:text-white/[0.04]"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 -z-10 size-[30rem] -translate-x-1/2 -translate-y-1/2 animate-[spin_60s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,transparent_0_80%,var(--link)_95%,transparent)] opacity-[0.12] [mask:radial-gradient(closest-side,transparent_calc(100%-2px),#000_100%)]"
      />

      <div className="scale-[0.68] sm:scale-[0.84] md:scale-90 lg:scale-100 [@media(max-height:700px)]:scale-[0.56] lg:[@media(max-height:700px)]:scale-[0.74] lg:[@media(max-height:820px)]:scale-[0.88]">
        <Phone step={step} index={index} cycle={cycle} />
      </div>

      {/* Glass chip: lands beside the phone, alternating sides. */}
      <span
        key={`chip-${step.key}-${cycle}`}
        aria-hidden
        className={cn(
          "absolute top-[18%] z-20 flex animate-chip-in items-center gap-2 rounded-full bg-white/60 py-1.5 pr-3.5 pl-1.5 text-xs font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.7),inset_0_0_0_1px_rgb(255_255_255/0.45),0_8px_24px_-12px_oklch(0.3_0.12_264/0.35)] backdrop-blur-2xl backdrop-saturate-150 [animation-delay:700ms] sm:text-sm dark:bg-[oklch(0.2_0.03_265/0.62)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(255_255_255/0.08),0_10px_28px_-12px_rgb(0_0_0/0.7)]",
          index % 2 ? "left-[6%] sm:left-[10%]" : "right-[6%] sm:right-[10%]",
        )}
      >
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon filled className="size-3.5" />
        </span>
        {chip}
      </span>
    </>
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
 * An iPhone (Pro style) per theme: natural titanium with a soft navy shadow on light pages,
 * black titanium with a faint edge highlight and a deep shadow on dark ones. Each step turns
 * it to a new 3D pose (spring), slides in that step's app screen (iOS push), drops a
 * notification from the Dynamic Island (which opens as a Live Activity) and sweeps a sheen
 * across the glass. It floats gently; everything moving stops under reduced motion.
 */
function Phone({
  step,
  index,
  cycle,
}: {
  step: (typeof STEPS)[number];
  index: number;
  cycle: number;
}) {
  const time = useClock();
  const Icon = step.icon;
  const side =
    "absolute w-[3px] bg-linear-to-b from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-800";
  return (
    <div aria-hidden className="[perspective:1200px]">
      <div
        className="transition-transform duration-1000 ease-spring [transform-style:preserve-3d]"
        style={{
          transform: `rotateX(${step.pose.x}deg) rotateY(${step.pose.y}deg) rotateZ(${step.pose.z}deg)`,
        }}
      >
        <div data-phone-live className="relative w-[14.5rem] animate-float">
          {/* Side buttons: action, volume up/down (left); side button (right). */}
          <span className={cn(side, "top-[5.5rem] -left-[2px] h-6 rounded-l-[2px]")} />
          <span className={cn(side, "top-[8rem] -left-[2px] h-11 rounded-l-[2px]")} />
          <span className={cn(side, "top-[11.25rem] -left-[2px] h-11 rounded-l-[2px]")} />
          <span className={cn(side, "top-[9rem] -right-[2px] h-16 rounded-r-[2px]")} />

          {/* Titanium frame. */}
          <div className="rounded-[3rem] bg-linear-to-br from-zinc-200 via-zinc-50 to-zinc-300 p-[2.5px] shadow-[0_2px_4px_oklch(0.3_0.08_264/0.12),0_30px_60px_-22px_oklch(0.3_0.12_264/0.5)] dark:from-zinc-600 dark:via-zinc-800 dark:to-zinc-700 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_40px_80px_-24px_rgb(0_0_0/0.95)]">
            {/* Bezel. */}
            <div className="rounded-[calc(3rem-2.5px)] bg-black p-[6px]">
              {/* Screen. */}
              <div className="relative h-[28rem] overflow-hidden rounded-[2.5rem] bg-[oklch(0.985_0.004_265)] text-foreground dark:bg-[oklch(0.14_0.012_268)]">
                {/* Status bar. */}
                <div className="absolute inset-x-0 top-0 z-30 flex h-10 items-center justify-between px-3.5 text-[0.62rem] font-semibold num">
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
                    <span className="relative flex h-[0.55rem] w-[1rem] items-center rounded-[3px] bg-foreground/25 p-[1.5px]">
                      <span className="h-full w-[78%] rounded-[1.5px] bg-foreground" />
                    </span>
                  </span>
                </div>

                {/* Dynamic Island: a Live Activity for the step. */}
                <div
                  key={`island-${step.key}-${cycle}`}
                  data-phone-live
                  className="absolute top-2.5 left-1/2 z-40 flex h-[1.45rem] w-[5.25rem] -translate-x-1/2 animate-[island-live_2.4s_var(--ease-spring)_both] items-center justify-between overflow-hidden rounded-full bg-black px-1.5"
                >
                  <span
                    data-phone-live
                    className="inline-flex size-4 animate-[island-content_2.4s_ease_both] items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0"
                  >
                    <Icon className="size-2.5" />
                  </span>
                  <span
                    data-phone-live
                    className="flex animate-[island-content_2.4s_ease_both] items-center gap-[2px] pr-0.5 opacity-0"
                  >
                    {STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "size-[4px] rounded-full",
                          i <= index ? "bg-sky" : "bg-white/25",
                        )}
                      />
                    ))}
                  </span>
                </div>

                {/* Notification: drops from the island shortly after the screen changes. */}
                <div
                  key={`banner-${step.key}-${cycle}`}
                  className="absolute inset-x-2.5 top-11 z-30 flex animate-banner-drop items-center gap-2 rounded-2xl bg-white/75 p-2 shadow-[0_6px_16px_-8px_oklch(0.3_0.1_264/0.35)] backdrop-blur-xl [animation-delay:900ms] dark:bg-white/[0.1] dark:shadow-none"
                >
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Icon filled className="size-3.5" />
                  </span>
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="h-1.5 w-1/3 rounded-full bg-foreground/30" />
                    <span className="h-1.5 w-3/4 rounded-full bg-foreground/15" />
                  </span>
                </div>

                {/* App bar. */}
                <div className="absolute inset-x-0 top-10 z-20 flex items-center gap-2 px-4 pt-1.5">
                  <span className="inline-flex size-6 items-center justify-center rounded-lg bg-primary">
                    <svg viewBox="0 0 32 32" className="size-4">
                      <path
                        d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"
                        className="fill-primary-foreground"
                      />
                    </svg>
                  </span>
                  <span className="h-2 w-14 rounded-full bg-foreground/20" />
                  <span className="ml-auto size-6 rounded-full bg-primary-soft" />
                </div>

                {/* The step's screen: pushed in from the right, like iOS navigation. */}
                <div
                  key={step.key}
                  className="absolute inset-x-0 top-[4.75rem] bottom-0 flex animate-screen-push flex-col gap-3 px-4 pb-8"
                >
                  {/* Re-keyed each cycle: the screen's ticks, bars and switches play again. */}
                  <div key={cycle} className="contents">
                    {step.key === "account" && <AccountScreen />}
                    {step.key === "apply" && <ApplyScreen />}
                    {step.key === "pay" && <PayScreen />}
                    {step.key === "license" && <LicenceScreen />}
                  </div>
                </div>

                {/* Home indicator. */}
                <span className="absolute bottom-2 left-1/2 z-30 h-1 w-24 -translate-x-1/2 rounded-full bg-foreground/35" />

                {/* Glass: a faint static glare and a sheen when the screen changes. */}
                <span className="pointer-events-none absolute inset-0 z-30 bg-linear-to-br from-white/[0.08] via-transparent to-transparent dark:from-white/[0.04]" />
                <span
                  key={`sheen-${step.key}-${cycle}`}
                  data-phone-live
                  className="pointer-events-none absolute -inset-y-10 left-0 z-30 w-1/3 animate-[glass-sheen_1.4s_var(--ease-enter)_both] bg-linear-to-r from-transparent via-white/[0.14] to-transparent dark:via-white/[0.06]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A placeholder text line that grows in. */
function Bar({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <span
      className={cn(
        "block h-2 origin-left animate-[meter-in_700ms_var(--ease-enter)_both] rounded-full bg-foreground/15",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function Tick({ delay }: { delay: number }) {
  return (
    <span
      className="inline-flex size-5 shrink-0 animate-pop items-center justify-center rounded-full bg-success text-white"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Check className="size-3" strokeWidth={3} />
    </span>
  );
}

const ROW =
  "flex items-center gap-2.5 rounded-xl bg-foreground/[0.045] px-3 py-2.5 dark:bg-white/[0.05]";

function AccountScreen() {
  return (
    <>
      <span className="mt-2 inline-flex size-12 animate-pop items-center justify-center self-center rounded-2xl bg-primary-soft text-link">
        <UserPlus className="size-6" />
      </span>
      <Bar className="mx-auto w-1/2" delay={100} />
      {[Mail, Smartphone].map((Icon, i) => (
        <span key={i} className={ROW}>
          <Icon className="size-4 text-link" />
          <Bar className="flex-1" delay={300 + i * 250} />
          <Tick delay={900 + i * 300} />
        </span>
      ))}
      {/* Two-step verification switches on. */}
      <span className={ROW}>
        <ShieldCheck className="size-4 text-link" />
        <Bar className="flex-1" delay={800} />
        <span className="relative h-5 w-9 shrink-0 animate-[toggle-track_400ms_ease_1500ms_both] rounded-full bg-foreground/15">
          <span className="absolute top-0.5 left-0.5 size-4 animate-[toggle-knob_400ms_var(--ease-spring)_1500ms_both] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]" />
        </span>
      </span>
      <span className="mt-auto flex h-9 animate-rise items-center justify-center rounded-xl bg-primary [animation-delay:1200ms]">
        <Bar className="w-1/3 bg-primary-foreground/70" delay={1300} />
      </span>
    </>
  );
}

function ApplyScreen() {
  return (
    <>
      <div className="mt-1 flex items-center gap-3">
        <ProgressRing value={4} total={5} className="size-14">
          <span className="text-xs font-bold num">80%</span>
        </ProgressRing>
        <div className="flex flex-1 flex-col gap-2">
          <Bar className="w-full" />
          <Bar className="w-1/2 bg-foreground/10" delay={100} />
        </div>
      </div>
      <ol className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className={ROW}>
            {i < 4 ? (
              <Tick delay={250 + i * 200} />
            ) : (
              <span className="size-5 shrink-0 animate-pulse rounded-full bg-primary/25" />
            )}
            <Bar className={cn("flex-1", i === 4 && "bg-primary/30")} delay={150 + i * 120} />
          </li>
        ))}
      </ol>
    </>
  );
}

function PayScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <span className="relative inline-flex size-16 items-center justify-center rounded-2xl bg-sun text-sun-foreground">
        <Smartphone className="size-8" />
        <span className="absolute -inset-2 animate-pulse-ring rounded-[1.25rem] text-sun" />
      </span>
      <span className="font-mono text-lg font-bold num tracking-tight">RWF •••</span>
      <div className="flex gap-2.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="size-3 animate-pop rounded-full bg-primary"
            style={{ animationDelay: `${500 + i * 260}ms` }}
          />
        ))}
      </div>
      <ProgressRing value={3} total={4} tone="ember" className="size-12" thickness={3}>
        <span className="text-[0.65rem] font-bold num">0:45</span>
      </ProgressRing>
    </div>
  );
}

function LicenceScreen() {
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="relative flex aspect-[1.586] animate-pop flex-col justify-between overflow-hidden rounded-2xl bg-brand p-3 shadow-[0_10px_24px_-12px_oklch(0.3_0.14_264/0.6)]">
        <div aria-hidden className="absolute inset-0 bg-imigongo text-white opacity-[0.07]" />
        <div className="relative flex items-start justify-between">
          <Bar className="w-14 bg-white/40" />
          <span className="inline-flex animate-pop items-center rounded-full bg-white px-1.5 py-0.5 text-brand [animation-delay:900ms]">
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
                className={cn("rounded-[1px]", (i * 7) % 3 ? "bg-zinc-900" : "bg-transparent")}
              />
            ))}
            <span className="absolute inset-x-0.5 top-0.5 h-0.5 animate-scan-beam rounded-full bg-sky shadow-[0_0_8px_2px] shadow-sky/70 [--beam-travel:2.5rem]" />
          </span>
        </div>
      </div>
      <span className="flex animate-rise items-center gap-2 self-center rounded-full bg-success-soft px-3 py-1.5 text-success [animation-delay:600ms]">
        <BadgeCheck filled className="size-4" />
        <Bar className="w-16 bg-success/30" delay={700} />
      </span>
    </div>
  );
}
