"use client";

import { ArrowRight } from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DECISIONS, RECOMMENDATIONS } from "@rebp/contracts";
import { ProfileBuddy, type BuddyMood } from "@/components/profile/profile-buddy";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Outcome = (typeof RECOMMENDATIONS)[number] | (typeof DECISIONS)[number];

/** The companion acts out the outcome just signed (UX-036). */
const MOOD: Record<Outcome, BuddyMood> = {
  APPROVE: "celebrate",
  REFER: "documents",
  REJECT: "worried",
  APPROVED: "celebrate",
  APPROVED_WITH_CONDITIONS: "badge",
  DEFERRED: "waiting",
  REJECTED: "worried",
};
/** Confetti only when something was approved. */
const CHEER: readonly Outcome[] = ["APPROVE", "APPROVED", "APPROVED_WITH_CONDITIONS"];

/**
 * "Validation completed" (UX-036): opened by `?celebrate=<outcome>` after a review or a decision
 * is signed. The companion's mood follows the outcome — cheering for an approval, holding up the
 * file for a referral, waiting for a deferral, concerned for a rejection — and the next step is
 * one tap away. Closing it drops the flag from the URL so a reload doesn't replay it.
 */
export function ValidationCelebration({
  kind,
  reference,
  nextHref,
}: {
  kind: "review" | "decision";
  reference: string;
  /** Where "Next file" leads; the queue (or the decisions list) when there's none. */
  nextHref?: string;
}) {
  const t = useTranslations("review.celebrate");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const flag = params.get("celebrate");
  const outcomes: readonly string[] = kind === "review" ? RECOMMENDATIONS : DECISIONS;
  const outcome = flag && outcomes.includes(flag) ? (flag as Outcome) : null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!outcome) return;
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, [outcome]);

  const close = () => {
    setOpen(false);
    const next = new URLSearchParams(params);
    next.delete("celebrate");
    const query = next.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}` as Route, { scroll: false });
  };

  if (!outcome) return null;
  const cheer = CHEER.includes(outcome);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="gap-0 overflow-hidden border-0 p-0 sm:max-w-md sm:p-0"
        data-testid="validation-celebration"
      >
        <div className="relative isolate flex flex-col items-center gap-3 overflow-hidden bg-[linear-gradient(165deg,color-mix(in_oklch,var(--primary)_16%,var(--card)),var(--card)_70%)] px-6 pt-8 pb-6 text-center">
          {cheer && (
            <div aria-hidden data-loop className="pointer-events-none absolute inset-0 -z-10">
              {Array.from({ length: 24 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "celebrate-piece absolute top-0 block h-2.5 w-1.5 rounded-[2px]",
                    ["bg-primary", "bg-sun", "bg-sky", "bg-primary"][i % 4],
                  )}
                  style={{
                    left: `${(i * 37) % 100}%`,
                    animationDelay: `${(i % 7) * 0.32}s`,
                    animationDuration: `${2.6 + (i % 5) * 0.35}s`,
                  }}
                />
              ))}
            </div>
          )}
          <ProfileBuddy mood={MOOD[outcome]} hop={1} className="h-40 w-auto animate-pop" />
          <DialogTitle className="text-[clamp(1.5rem,1.2rem+1.4vw,2rem)] leading-tight font-extrabold tracking-[-0.02em]">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="max-w-xs text-sm text-muted-foreground">
            {t(`${kind}.${outcome}` as never)}
          </DialogDescription>
          <span className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 font-mono text-sm font-bold text-primary-foreground">
            {reference}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 p-5">
          <button
            type="button"
            onClick={close}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-link transition-colors hover:bg-primary-soft"
          >
            {t("stay")}
          </button>
          <Link
            href={
              (nextHref ??
                (kind === "review" ? "/backoffice/queue" : "/backoffice/decisions")) as Route
            }
            onClick={() => setOpen(false)}
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
          >
            {t("next")}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
