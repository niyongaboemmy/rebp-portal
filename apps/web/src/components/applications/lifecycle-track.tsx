"use client";

import { useTranslations } from "next-intl";
import {
  Check,
  CreditCard,
  Gavel,
  PenLine,
  ScanSearch,
  Signature,
  UserCheck,
  type LucideIcon,
} from "@/components/icons";
import { LIFECYCLE, type LifecycleState, type LifecycleStep } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";

const ICONS: Record<LifecycleStep, LucideIcon> = {
  fill: PenLine,
  sign: Signature,
  pay: CreditCard,
  confirm: UserCheck,
  review: ScanSearch,
  decision: Gavel,
};

/**
 * The whole journey as one track (UX-028): the applicant's part (fill in, sign, pay) and the
 * regulator's (confirmations, review, decision). Done steps carry a soft tick, the current one
 * glows and pulses (red when the applicant must act), what's ahead is dashed; the line fills as it
 * advances. `compact` is the list card's version: dots and the current step's name.
 */
export function LifecycleTrack({
  index,
  state,
  compact = false,
  className,
}: {
  index: number;
  state: LifecycleState;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("lifecycle");
  const complete = state === "done";
  const current = LIFECYCLE[index]!;
  const label = t("label", {
    step: t(`steps.${current}`),
    n: index + 1,
    total: LIFECYCLE.length,
  });

  if (compact)
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <ol aria-label={label} className="flex items-center">
          {LIFECYCLE.map((step, i) => {
            const done = complete || i < index;
            const now = !complete && i === index;
            return (
              <li key={step} className="flex flex-1 items-center last:flex-none">
                <span
                  aria-hidden
                  className={cn(
                    "relative inline-flex size-2.5 shrink-0 rounded-full transition-colors",
                    done && "bg-primary",
                    now &&
                      (state === "attention" || state === "refused"
                        ? "lifecycle-pulse-danger size-3 bg-destructive"
                        : state === "stopped"
                          ? "size-3 bg-muted-foreground"
                          : "lifecycle-pulse size-3 bg-primary"),
                    !done && !now && "bg-foreground/[0.12] dark:bg-white/[0.14]",
                  )}
                />
                {i < LIFECYCLE.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "mx-1 h-0.5 flex-1 rounded-full",
                      done ? "bg-primary" : "bg-foreground/[0.08] dark:bg-white/[0.1]",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
        <span className="text-xs text-muted-foreground">
          {complete ? (
            <span className="font-semibold text-link">{t("complete")}</span>
          ) : (
            <>
              <span className="font-semibold text-foreground">{t(`steps.${current}`)}</span> ·{" "}
              {t("stepOf", { n: index + 1, total: LIFECYCLE.length })}
            </>
          )}
        </span>
      </div>
    );

  return (
    <div className={cn("@container/track", className)}>
      <ol aria-label={label} className="grid grid-cols-6 items-start">
        {LIFECYCLE.map((step, i) => {
          const Icon = ICONS[step];
          const done = complete || i < index;
          const now = !complete && i === index;
          const tone = now
            ? state === "attention" || state === "refused"
              ? "danger"
              : state === "stopped"
                ? "stopped"
                : "now"
            : done
              ? "done"
              : "todo";
          return (
            <li key={step} className="relative flex flex-col items-center gap-1.5 text-center">
              {/* The line to the next step, filled when this one is done. */}
              {i < LIFECYCLE.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-5 left-[calc(50%+1.5rem)] h-0.5 w-[calc(100%-3rem)] overflow-hidden rounded-full bg-foreground/[0.08] dark:bg-white/[0.1]"
                >
                  <span
                    className={cn(
                      "block h-full origin-left rounded-full bg-primary transition-transform duration-(--dur-5) ease-(--ease-enter)",
                      done ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              )}
              <span
                aria-hidden
                className={cn(
                  "relative inline-flex size-10 items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-(--dur-3)",
                  tone === "done" && "bg-primary-soft text-link",
                  tone === "now" && "lifecycle-pulse bg-primary text-primary-foreground",
                  tone === "danger" && "lifecycle-pulse-danger bg-destructive text-white",
                  tone === "stopped" && "bg-muted text-muted-foreground",
                  tone === "todo" &&
                    "border border-dashed border-foreground/20 bg-card text-muted-foreground dark:bg-surface-2",
                )}
              >
                <Icon className="size-[1.15rem]" />
                {tone === "done" && (
                  <span className="absolute -right-0.5 -bottom-0.5 inline-flex size-4 items-center justify-center rounded-full bg-card text-link ring-1 ring-primary/40">
                    <Check className="size-2.5" strokeWidth={2.5} />
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[0.7rem] leading-tight font-semibold @md/track:text-xs",
                  // Narrow: only the current step is named, so labels never collide.
                  !now && "@max-md/track:sr-only",
                  now ? "text-foreground" : done ? "text-link" : "text-muted-foreground",
                )}
              >
                {t(`steps.${step}`)}
              </span>
              {/* Whose turn it is: the applicant's three steps, then the regulator's. */}
              {(i === 0 || i === 3) && (
                <span className="hidden text-[0.6rem] font-bold tracking-widest text-muted-foreground uppercase @lg/track:block">
                  {i === 0 ? t("you") : t("regulator")}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
