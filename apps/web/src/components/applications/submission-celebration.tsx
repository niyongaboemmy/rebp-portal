"use client";

import { ArrowRight, Bell, ClipboardCheck, Clock3, Wallet } from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { EligibilityPerson } from "@/components/eligibility/eligibility-person";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The end of the process, celebrated (FR-PORTAL-002): a full dialog with the cheering companion
 * and confetti, the reference, and what happens next in three short steps.
 * - "submitted": opened by `?celebrate=1` after signing (no fee) or after payment.
 * - "issued": once per licence (remembered in this browser), when the decision is a licence.
 * Closing it removes the flag from the URL, so a reload doesn't celebrate twice.
 */
export function SubmissionCelebration({
  kind,
  reference,
  category,
  seenKey,
}: {
  kind: "submitted" | "issued";
  reference: string;
  category: string;
  /** For "issued": the localStorage key that remembers it was shown. */
  seenKey?: string;
}) {
  const t = useTranslations("applications.celebrate");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let show = false;
    if (kind === "submitted") show = params.get("celebrate") === "1";
    else if (seenKey) {
      try {
        show = !localStorage.getItem(seenKey);
        localStorage.setItem(seenKey, "1");
      } catch {
        show = false;
      }
    }
    if (!show) return;
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, [kind, params, seenKey]);

  const close = () => {
    setOpen(false);
    if (params.get("celebrate")) router.replace(pathname as Route, { scroll: false });
  };

  const steps =
    kind === "submitted"
      ? [
          { icon: ClipboardCheck, key: "review" },
          { icon: Bell, key: "notify" },
          { icon: Clock3, key: "decision" },
        ]
      : [
          { icon: Wallet, key: "wallet" },
          { icon: ClipboardCheck, key: "verify" },
          { icon: Bell, key: "renew" },
        ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="gap-0 overflow-hidden border-0 p-0 sm:max-w-lg sm:p-0">
        <div className="relative isolate flex flex-col items-center gap-3 overflow-hidden bg-[linear-gradient(165deg,color-mix(in_oklch,var(--primary)_16%,var(--card)),var(--card)_70%)] px-6 pt-8 pb-6 text-center">
          <div aria-hidden data-loop className="pointer-events-none absolute inset-0 -z-10">
            {Array.from({ length: 26 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "celebrate-piece absolute top-0 block h-2.5 w-1.5 rounded-[2px]",
                  ["bg-primary", "bg-sun", "bg-ember", "bg-sky", "bg-primary"][i % 5],
                )}
                style={{
                  left: `${(i * 37) % 100}%`,
                  animationDelay: `${(i % 7) * 0.32}s`,
                  animationDuration: `${2.6 + (i % 5) * 0.35}s`,
                }}
              />
            ))}
          </div>
          <EligibilityPerson mood="happy" className="w-48 animate-pop sm:w-56" />
          <DialogTitle className="text-[clamp(1.6rem,1.2rem+1.6vw,2.1rem)] leading-tight font-extrabold tracking-[-0.02em]">
            {t(`${kind}.title`)}
          </DialogTitle>
          <DialogDescription className="max-w-sm text-sm text-muted-foreground">
            {t(`${kind}.body`, { category })}
          </DialogDescription>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 font-mono text-sm font-bold text-primary-foreground shadow-[0_12px_26px_-12px_oklch(0.45_0.2_264/0.8)]">
            {reference}
          </span>
        </div>
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            {t("next")}
          </span>
          <ol className="flex flex-col gap-3">
            {steps.map(({ icon: Icon, key }, i) => (
              <li
                key={key}
                className="flex animate-rise items-start gap-3"
                style={{ animationDelay: `${200 + i * 90}ms` }}
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link dark:bg-surface-2">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{t(`${kind}.steps.${key}.title`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`${kind}.steps.${key}.body`)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {kind === "issued" ? (
            <Link
              href={"/licenses" as Route}
              onClick={close}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
            >
              {t("issued.cta")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          ) : (
            // Submitted (UX-027): continue to the applications list; or stay and follow this one.
            <div className="flex flex-col gap-2">
              <Link
                href={"/applications" as Route}
                onClick={close}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
              >
                {t("submitted.continue")}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold text-link transition-colors hover:bg-primary-soft"
              >
                {t("submitted.cta")}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
