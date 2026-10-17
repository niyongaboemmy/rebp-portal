import { Check } from "@/components/icons";
import type { StatusTone } from "@rebp/contracts";
import { cn } from "@/lib/utils";
import { TONE_FILL, TONE_ICONS, TONE_TEXT } from "./tones";

export interface TimelineStep {
  key: string;
  title: React.ReactNode;
  /** Short meta line: a date, an actor or an SLA expectation. */
  meta?: React.ReactNode;
  state: "done" | "current" | "upcoming";
  /** Tone for the current step (e.g. warning when action is required). */
  tone?: StatusTone;
}

/**
 * Status timeline (FR-PORTAL-002): vertical on phones, horizontal from `lg` when `responsive`.
 * The current node pulses (disabled under reduced motion). An ordered list for screen readers.
 */
export function StatusTimeline({
  steps,
  responsive = false,
  className,
}: {
  steps: TimelineStep[];
  responsive?: boolean;
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "relative flex flex-col",
        responsive && "@3xl/main:flex-row @3xl/main:items-start @3xl/main:justify-between",
        className,
      )}
    >
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const tone = step.tone ?? "info";
        const ToneIcon = TONE_ICONS[tone];
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn(
              "relative flex gap-3 pb-6 last:pb-0",
              responsive &&
                "@3xl/main:flex-1 @3xl/main:flex-col @3xl/main:items-center @3xl/main:pb-0 @3xl/main:text-center",
            )}
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-8 bottom-0 left-[0.9375rem] w-0.5 -translate-x-1/2",
                  responsive &&
                    "@3xl/main:top-[0.9375rem] @3xl/main:right-[-50%] @3xl/main:bottom-auto @3xl/main:left-1/2 @3xl/main:h-0.5 @3xl/main:w-auto @3xl/main:translate-x-4",
                  step.state === "done" ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 inline-flex size-[1.875rem] shrink-0 items-center justify-center rounded-full border-2 bg-card",
                step.state === "done" && "border-primary bg-primary text-primary-foreground",
                step.state === "current" &&
                  cn("animate-pulse-ring border-current", TONE_TEXT[tone]),
                step.state === "upcoming" && "border-border text-muted-foreground",
              )}
            >
              {step.state === "done" ? (
                <Check className="size-4" strokeWidth={3} aria-hidden />
              ) : step.state === "current" ? (
                <ToneIcon className="size-4" aria-hidden />
              ) : (
                <span className={cn("size-2 rounded-full", TONE_FILL.neutral, "opacity-40")} />
              )}
            </span>
            <div
              className={cn("flex min-w-0 flex-col gap-0.5 pt-1", responsive && "@3xl/main:px-2")}
            >
              <span
                className={cn(
                  "text-sm font-semibold",
                  step.state === "upcoming" && "text-muted-foreground",
                )}
              >
                {step.title}
              </span>
              {step.meta && <span className="text-xs text-muted-foreground">{step.meta}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
