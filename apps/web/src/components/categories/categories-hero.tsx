import { ArrowRight, ListChecks, MapPin } from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CATEGORIES, CATEGORY_INFO } from "@rebp/contracts";
import { SketchUnderline } from "@/components/motion/sketch-underline";
import { TIER_TILE } from "@/components/registry/tones";
import { cn } from "@/lib/utils";

/** Step heights for the staircase (percent of the stage), G1 → G8. */
const STEP = [30, 38, 50, 62, 70, 78, 88, 96];

/**
 * FR-PORTAL-007 hero for the categories page: the pitch and two next steps on the left; on the
 * right, the eight categories as a rising staircase in their tier colours (entry sky → firm
 * Ember), each step floating gently, with the tiers named beneath. A preview of the career map
 * that follows; decorative, the map below is the accessible version.
 */
export async function CategoriesHero() {
  const t = await getTranslations("categories");
  const STATS = [
    { value: "8", label: t("stats.categories") },
    { value: "4", label: t("stats.tiers") },
    { value: "3", label: t("stats.years") },
  ];

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-80 bg-imigongo-fade text-link opacity-[0.05]"
      />
      <div
        aria-hidden
        className="absolute top-10 right-[8%] -z-10 size-[26rem] rounded-full bg-primary/[0.08] blur-3xl dark:bg-primary/[0.14]"
      />
      <div className="container-page grid grid-cols-[minmax(0,1fr)] items-center gap-10 pt-10 pb-12 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 lg:pb-16">
        <div className="flex min-w-0 flex-col gap-5">
          <span className="inline-flex w-fit animate-rise items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-foreground">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inset-0 animate-ping rounded-full bg-ember/70" />
              <span className="relative size-1.5 rounded-full bg-ember" />
            </span>
            {t("eyebrow")}
          </span>
          <div className="flex flex-col gap-2">
            <h1
              className="animate-rise text-[clamp(2.1rem,1.4rem+2.6vw,3.5rem)] leading-[1.05] font-bold tracking-[-0.025em] text-balance"
              style={{ animationDelay: "60ms" }}
            >
              {t("title")}
            </h1>
            <SketchUnderline className="h-2.5 w-36 sm:h-3 sm:w-44" />
          </div>
          <p
            className="max-w-xl animate-rise text-base text-muted-foreground sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            {t("subtitle")}
          </p>
          <div
            className="flex animate-rise flex-wrap items-center gap-3"
            style={{ animationDelay: "180ms" }}
          >
            <Link
              href={"/eligibility" as Route}
              className="group inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
            >
              <ListChecks className="size-4" aria-hidden />
              {t("hero.findMine")}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
            <Link
              href={"#career-map" as Route}
              className="group inline-flex h-11 items-center gap-2 rounded-full bg-foreground/[0.05] px-5 text-sm font-semibold transition-colors hover:bg-foreground/[0.09] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
            >
              <MapPin className="size-4 text-link" aria-hidden />
              {t("hero.explore")}
            </Link>
          </div>
          <dl
            className="mt-2 flex animate-rise flex-wrap gap-x-8 gap-y-3"
            style={{ animationDelay: "240ms" }}
          >
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col">
                <dd className="text-3xl leading-none font-bold num tracking-[-0.02em]">
                  {s.value}
                </dd>
                <dt className="mt-1 text-xs text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        {/* The staircase. */}
        <div
          aria-hidden
          className="relative animate-rise rounded-[2rem] bg-card/80 p-5 shadow-[0_1px_2px_oklch(0.3_0.08_264/0.06),0_24px_60px_-30px_oklch(0.35_0.15_264/0.45)] backdrop-blur-xl sm:p-6 dark:bg-white/[0.04] dark:shadow-none"
          style={{ animationDelay: "160ms" }}
        >
          <div className="relative flex h-64 items-end gap-1.5 sm:h-72 sm:gap-2">
            {/* Rising guide line through the step tops. */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 size-full overflow-visible max-sm:hidden"
            >
              <polyline
                points={STEP.map((h, i) => `${(i + 0.5) * 12.5},${100 - h + 4}`).join(" ")}
                fill="none"
                className="stroke-sun"
                strokeWidth="0.8"
                strokeDasharray="1.6 2.4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{
                  animation:
                    "category-route 1.6s var(--ease-enter) 500ms both, route-flow 1.4s linear infinite",
                }}
                pathLength={100}
              />
            </svg>
            {/* A spark climbs the staircase, step by step, forever. */}
            <span
              data-loop
              className="stair-spark pointer-events-none absolute z-10 size-3 -translate-x-1/2 -translate-y-[1.9rem] rounded-full bg-sun max-sm:hidden"
            />
            {CATEGORIES.map((c, i) => {
              const info = CATEGORY_INFO[c];
              return (
                <div
                  key={c}
                  className="relative flex flex-1 flex-col items-center justify-end"
                  style={{ height: `${STEP[i]!}%` }}
                >
                  <div
                    className="flex w-full animate-float flex-col items-center gap-1.5"
                    style={{ animationDelay: `${i * 380}ms`, animationDuration: "7s" }}
                  >
                    <span
                      data-loop
                      className="stair-badge relative rounded-xl"
                      style={{ "--i": i } as React.CSSProperties}
                    >
                      <span
                        className={cn(
                          "inline-flex size-9 animate-pop items-center justify-center rounded-xl text-[0.7rem] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_20px_-10px_oklch(0.35_0.18_264/0.8)] sm:size-10",
                          TIER_TILE[info.tier],
                        )}
                        style={{ animationDelay: `${300 + i * 90}ms` }}
                      >
                        {info.section}
                      </span>
                    </span>
                    <span className="w-full truncate text-center text-[0.65rem] font-semibold text-muted-foreground max-sm:hidden">
                      {t(`short.${c}`)}
                    </span>
                  </div>
                  <span
                    data-loop
                    className="stair-bar relative mt-2 w-full overflow-hidden rounded-t-xl"
                    style={{ height: `${STEP[i]! * 0.9}%`, "--i": i } as React.CSSProperties}
                  >
                    <span
                      className={cn(
                        "absolute inset-0 origin-bottom animate-[grow-y_900ms_var(--ease-enter)_both] opacity-25 dark:opacity-30",
                        TIER_TILE[info.tier],
                      )}
                      style={{ animationDelay: `${200 + i * 80}ms` }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-8 gap-1.5 border-t border-foreground/[0.07] pt-3 text-[0.65rem] font-bold tracking-widest text-muted-foreground uppercase sm:gap-2">
            <span className="col-span-2">{t("tiers.entry")}</span>
            <span className="col-span-1">{t("tiers.agent")}</span>
            <span className="col-span-4">{t("tiers.broker")}</span>
            <span className="col-span-1 text-ember-text">{t("tiers.firm")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
