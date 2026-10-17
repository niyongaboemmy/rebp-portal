"use client";

import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileStack,
  FileText,
  History,
  ScanSearch,
  UserRound,
  type LucideIcon,
} from "@/components/icons";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ConsoleTabKey =
  "documents" | "application" | "checks" | "review" | "history" | "applicant";

const ICONS: Record<ConsoleTabKey, LucideIcon> = {
  documents: FileStack,
  application: FileText,
  checks: ScanSearch,
  review: ClipboardCheck,
  history: History,
  applicant: UserRound,
};

export interface ConsoleTab {
  key: ConsoleTabKey;
  label: string;
  /** Things to do here: an animated yellow count on the tab. */
  todo?: number;
  /** The tab holding the next action: a small pulsing primary dot. */
  next?: boolean;
  /** Its place in the officer's order of work (UX-036): ① check documents, ② record and sign. */
  step?: { n: number; state: "done" | "now" | "later" };
}

/** The order of work under the tab bar: "Step 1 of 2: … → then …". */
export interface ConsoleGuide {
  now: string;
  then?: string;
  n: number;
  total: number;
  /** Labels, already translated: "Step {n} of {total}", "Then". */
  stepLabel: string;
  thenLabel: string;
}

/** Switches the console to a tab from anywhere on the page (the floating action button). */
export const CONSOLE_TAB_EVENT = "review-console:tab";
export function openConsoleTab(key: ConsoleTabKey, focus?: string) {
  window.dispatchEvent(new CustomEvent(CONSOLE_TAB_EVENT, { detail: { key, focus } }));
}

/**
 * The review console in tabs (UX-036): one subject at a time instead of a long page. The tab
 * holding the next action opens first; each tab shows what's left to do there (a pulsing yellow
 * count) and a pill slides to the chosen one. Panels stay mounted (hidden) so a half-filled form
 * keeps its state; the choice is kept in the URL (?tab=) for links and reloads.
 */
export function ConsoleTabs({
  tabs,
  initial,
  panels,
  label,
  guide,
}: {
  tabs: ConsoleTab[];
  guide?: ConsoleGuide;
  initial: ConsoleTabKey;
  panels: Partial<Record<ConsoleTabKey, React.ReactNode>>;
  label: string;
}) {
  const [active, setActive] = useState<ConsoleTabKey>(initial);
  const track = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0 });

  const select = useCallback((key: ConsoleTabKey, focus?: string) => {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new CustomEvent(`${CONSOLE_TAB_EVENT}:changed`, { detail: key }));
    // Bring the panel (or the element asked for) into view under the sticky tab bar.
    window.requestAnimationFrame(() => {
      const target = (focus && document.getElementById(focus)) || track.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(`${CONSOLE_TAB_EVENT}:changed`, { detail: initial }));
    const onOpen = (e: Event) => {
      const { key, focus } = (e as CustomEvent<{ key: ConsoleTabKey; focus?: string }>).detail;
      select(key, focus);
    };
    window.addEventListener(CONSOLE_TAB_EVENT, onOpen);
    return () => window.removeEventListener(CONSOLE_TAB_EVENT, onOpen);
  }, [initial, select]);

  // The sliding pill follows the chosen tab, and re-measures when the bar resizes.
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const tab = el.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (tab) setPill({ left: tab.offsetLeft, width: tab.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [active]);

  const onKey = (event: React.KeyboardEvent) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const i = tabs.findIndex((t) => t.key === active);
    const next = tabs[(i + step + tabs.length) % tabs.length]!.key;
    select(next);
    track.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
  };

  return (
    // Room at the bottom so the floating next-step button never covers the last row.
    <div className="flex flex-col gap-4 pb-24">
      <div className="sticky top-[calc(var(--header-h)+0.5rem)] z-20 -mx-1 px-1">
        <div
          ref={track}
          role="tablist"
          aria-label={label}
          onKeyDown={onKey}
          className="relative flex [scrollbar-width:none] gap-1 overflow-x-auto rounded-full bg-card/95 p-1 ring-1 ring-primary/[0.08] backdrop-blur-xl dark:bg-surface-2/95 dark:ring-white/[0.06]"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-full bg-primary transition-[transform,width] duration-(--dur-4) ease-(--ease-spring)"
            style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
          />
          {tabs.map((tab) => {
            const Icon = ICONS[tab.key];
            const selected = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`console-tab-${tab.key}`}
                data-tab={tab.key}
                aria-selected={selected}
                aria-controls={`console-panel-${tab.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(tab.key)}
                className={cn(
                  "relative z-10 inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors duration-(--dur-2) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 @xl/main:px-4",
                  selected
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.step ? (
                  // The step number: a soft tick when done, pulsing when it's now, quiet after.
                  <span
                    aria-hidden
                    className={cn(
                      "relative inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold num",
                      tab.step.state === "done" &&
                        (selected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary-soft text-link ring-1 ring-primary/30"),
                      tab.step.state === "now" &&
                        (selected
                          ? "bg-primary-foreground text-primary"
                          : "lifecycle-pulse bg-primary text-primary-foreground"),
                      tab.step.state === "later" &&
                        (selected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-foreground/[0.07] text-muted-foreground dark:bg-white/[0.08]"),
                    )}
                  >
                    {tab.step.state === "done" ? (
                      <Check className="size-3" strokeWidth={2.5} />
                    ) : (
                      tab.step.n
                    )}
                  </span>
                ) : (
                  <Icon
                    aria-hidden
                    className={cn(
                      "size-4 transition-transform duration-(--dur-3)",
                      selected && "scale-110",
                    )}
                  />
                )}
                {tab.label}
                {tab.todo ? (
                  <span
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.7rem] font-bold num",
                      selected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : // Yellow only where the officer should act now; elsewhere just a count.
                          tab.next
                          ? "missing-mark bg-sun text-sun-foreground"
                          : "bg-foreground/[0.07] text-muted-foreground dark:bg-white/[0.08]",
                    )}
                  >
                    {tab.todo}
                  </span>
                ) : tab.next && !selected ? (
                  <span aria-hidden className="relative flex size-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                    <span className="relative size-2 rounded-full bg-primary" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {guide && (
          // The order of work, in one line: what now, what then.
          <p className="mt-2 flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-card/95 px-3.5 py-1.5 text-xs text-muted-foreground ring-1 ring-primary/[0.08] backdrop-blur-xl dark:bg-surface-2/95 dark:ring-white/[0.06]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <span aria-hidden className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                <span className="relative size-2 rounded-full bg-primary" />
              </span>
              {guide.stepLabel}: {guide.now}
            </span>
            {guide.then && (
              <>
                <ArrowRight aria-hidden className="size-3.5 animate-pulse" />
                <span>
                  {guide.thenLabel}: {guide.then}
                </span>
              </>
            )}
          </p>
        )}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={`console-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`console-tab-${tab.key}`}
          hidden={tab.key !== active}
          className={cn(
            "flex min-w-0 flex-col gap-4",
            tab.key === active && "animate-in duration-300 ease-out fade-in slide-in-from-bottom-2",
          )}
        >
          {panels[tab.key]}
        </div>
      ))}
    </div>
  );
}
