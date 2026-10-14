"use client";

import { Check } from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/** How long each step stays in focus before the guide moves on. */
const STEP_MS = 2800;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * Guided path under the hero actions (FR-PORTAL-006: eligibility first): one compact pill of
 * three one-word steps. The guide walks through them by itself: the active step lifts onto a
 * card surface, its number turns primary and an Ember bar (the header's "you are here" marker)
 * fills beneath it; finished steps show a check. Pointing at or focusing a step jumps there and
 * holds. Reduced motion keeps the first step in focus.
 */
export function HeroGuide({
  label,
  steps,
  className,
}: {
  label: string;
  steps: { key: string; href: string; label: string }[];
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
  const still = held || reduced;

  const hold = (index: number) => {
    setActive(index);
    setHeld(true);
  };

  return (
    <nav
      aria-label={label}
      data-loop
      className={cn("animate-rise [animation-delay:620ms]", className)}
      onPointerLeave={() => setHeld(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
    >
      <ol className="inline-flex max-w-full items-center rounded-full bg-foreground/[0.04] p-1 dark:bg-white/[0.04]">
        {steps.map((step, index) => {
          const state = index < active ? "done" : index === active ? "active" : "next";
          return (
            <li key={step.key} className="flex items-center">
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-0.5 h-px w-3 transition-colors duration-(--dur-3) sm:w-5",
                    index <= active ? "bg-primary/50" : "bg-foreground/15",
                  )}
                />
              )}
              <Link
                href={step.href as Route}
                data-state={state}
                aria-current={state === "active" ? "step" : undefined}
                onPointerEnter={() => hold(index)}
                onFocus={() => hold(index)}
                className="group relative flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors duration-(--dur-2) outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=active]:bg-card data-[state=active]:text-foreground max-xs:data-[state=done]:pr-1 max-xs:data-[state=next]:pr-1 dark:data-[state=active]:bg-white/[0.08]"
              >
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-foreground/[0.06] text-[0.65rem] font-bold num transition-[background-color,color,transform] duration-(--dur-3) ease-spring group-data-[state=active]:scale-105 group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground group-data-[state=done]:bg-primary-soft group-data-[state=done]:text-link">
                  {state === "done" ? (
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                {/* Smallest phones: only the active step keeps its label. */}
                <span className={cn(state !== "active" && "max-xs:sr-only")}>{step.label}</span>
                {state === "active" && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-px h-0.5 overflow-hidden rounded-full"
                  >
                    <span
                      key={`${active}-${still}`}
                      className={cn(
                        "absolute inset-0 origin-left rounded-full bg-ember",
                        !still && "animate-guide-fill",
                      )}
                      style={
                        still
                          ? undefined
                          : { animationDuration: `${STEP_MS}ms`, animationTimingFunction: "linear" }
                      }
                      onAnimationEnd={() => setActive((index + 1) % steps.length)}
                    />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
