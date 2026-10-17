import { BadgeCheck, ScanLine } from "@/components/icons";
import { getFormatter, getTranslations } from "next-intl/server";
import { CATEGORY_INFO } from "@rebp/contracts";
import { HeroDeck } from "@/components/landing/hero-deck";
import { HeroStage } from "@/components/landing/hero-stage";
import { LicenceCard } from "@/components/licence/licence-card";
import { HeroScene } from "@/components/motion/hero-scene";
import { cn } from "@/lib/utils";
import { siteUrl } from "@/server/seo";

/**
 * The signature hero visual, shared by the landing page and the auth pages: the sample licence
 * on its stage (aurora, flowing grid floor, orbit comets, verify pulse), dealt with three
 * accent cards in a loop (HeroDeck), a contact shadow, the pointer tilt (HeroScene) and two
 * glass notifications. Decorative; reduced motion shows the settled composition.
 */
export async function HeroVisual({ className }: { className?: string }) {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const base = siteUrl();
  return (
    <HeroScene
      className={cn(
        "relative isolate mx-auto w-full max-w-md px-3 pt-12 pb-10 [perspective:1400px] sm:px-4 sm:py-14",
        className,
      )}
    >
      <HeroStage />
      <div
        aria-hidden
        className="absolute inset-x-[16%] bottom-3 -z-10 h-8 animate-card-ground rounded-[50%] bg-brand/40 blur-xl dark:bg-black/70"
      />
      <HeroDeck
        question={t("eligibility.title")}
        checking={t("landing.deckChecking")}
        yes={t("landing.deckYes")}
        licence={
          <>
            <LicenceCard
              holder="Aline Uwase"
              categoryName={t(`categories.items.FSLA.name`)}
              section={CATEGORY_INFO.FSLA.section}
              licenceNo="RL-2026-000123"
              statusLabel={t("status.licence.ACTIVE")}
              expiryLabel={t("licence.expires")}
              expiry={format.dateTime(new Date("2027-10-14"), { dateStyle: "medium" })}
              verifyUrl={`${base}/check/SAMPLE`}
              sampleLabel={t("licence.sample")}
              scanBeam
              hologram
            />
            {/* Laminate: a moving sheen plus a glare that follows the pointer. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]"
            >
              <div className="absolute inset-y-[-25%] left-0 w-1/4 animate-card-sheen bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div
                className="absolute inset-0 mix-blend-soft-light"
                style={{
                  background:
                    "radial-gradient(circle at calc(30% + var(--px) * 35%) calc(20% + var(--py) * 30%), rgb(255 255 255 / 0.55), transparent 55%)",
                  transition: "background 400ms",
                }}
              />
            </div>
          </>
        }
        verified={
          <span className="flex items-center gap-2 rounded-full bg-white/55 py-1.5 pr-3.5 pl-1.5 text-sm font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.7),inset_0_0_0_1px_rgb(255_255_255/0.45),0_8px_24px_-12px_oklch(0.3_0.12_264/0.35)] backdrop-blur-2xl backdrop-saturate-150 dark:bg-[oklch(0.2_0.03_265/0.62)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(255_255_255/0.08),0_10px_28px_-12px_rgb(0_0_0/0.7)]">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-soft text-link">
              <ScanLine className="size-4" />
            </span>
            {t("landing.scene.verified")}
          </span>
        }
        issued={
          <div className="flex w-64 items-center gap-3 rounded-2xl bg-white/55 p-2.5 pr-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.7),inset_0_0_0_1px_rgb(255_255_255/0.45),0_8px_24px_-12px_oklch(0.3_0.12_264/0.35)] backdrop-blur-2xl backdrop-saturate-150 dark:bg-[oklch(0.2_0.03_265/0.62)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(255_255_255/0.08),0_10px_28px_-12px_rgb(0_0_0/0.7)]">
            <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BadgeCheck filled className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-ember" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="flex items-center justify-between gap-2 text-[0.7rem] text-muted-foreground">
                <span className="font-semibold tracking-wide uppercase">REBP</span>
                {t("landing.scene.time")}
              </span>
              <span className="truncate text-sm font-semibold">
                {t("status.application.LICENSE_ISSUED")}
              </span>
            </span>
          </div>
        }
      />
    </HeroScene>
  );
}
