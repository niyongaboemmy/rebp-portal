import {
  ArrowRight,
  BadgeCheck,
  Check,
  Languages,
  Lock,
  ScanLine,
  Timer,
} from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { CATEGORY_INFO } from "@rebp/contracts";
import { CategoryLadder } from "@/components/categories/category-ladder";
import { ProgressRing } from "@/components/data/progress-ring";
import { JourneyDiagram } from "@/components/landing/journey-diagram";
import { LicenceCard } from "@/components/licence/licence-card";
import { HeroScene } from "@/components/motion/hero-scene";
import { parallaxStyle } from "@/components/motion/parallax";
import { SketchUnderline } from "@/components/motion/sketch-underline";
import { Reveal } from "@/components/motion/reveal";
import { VerifySearch } from "@/components/register/verify-search";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { publicPageMetadata, siteUrl } from "@/server/seo";

const TRUST = [
  { key: "secure", icon: Lock },
  { key: "transparent", icon: Timer },
  { key: "accessible", icon: Languages },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return publicPageMetadata({ path: "/", title: t("homeTitle"), description: t("description") });
}

export default async function LandingPage() {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const base = siteUrl();

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: t("meta.title"),
            url: base,
            potentialAction: {
              "@type": "SearchAction",
              target: `${base}/register?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: t("brand.body"),
            url: base,
            logo: `${base}/icon.svg`,
          },
        ]}
      />

      {/*
        Hero: at least one full screen tall and pulled up under the transparent header (-mt-16).
        Type, spacing and the card scale with viewport *height*, so short laptops and tall
        phones both fit the whole story above the fold.
      */}
      <section className="relative isolate -mt-16 flex min-h-svh items-center overflow-hidden pt-16">
        <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-80 bg-imigongo-fade text-link opacity-[0.05]"
        />
        <div className="container-page grid gap-[clamp(1.5rem,5vh,4rem)] py-[clamp(1.5rem,6vh,5rem)] lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-14">
          <div className="flex flex-col gap-[clamp(0.9rem,2.6vh,1.6rem)]">
            <span className="inline-flex w-fit animate-rise items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-foreground">
              <BadgeCheck className="size-3.5" aria-hidden /> {t("landing.eyebrow")}
            </span>
            <h1
              className="animate-rise text-[clamp(2.25rem,min(5.4vw,8.4vh),5.25rem)] leading-[1.02] font-extrabold tracking-[-0.035em]"
              style={{ animationDelay: "60ms" }}
            >
              {t("landing.title")}
            </h1>
            <SketchUnderline className="-mt-3" />
            <p
              className="max-w-xl animate-rise text-[clamp(1rem,min(1.5vw,2.3vh),1.25rem)] text-muted-foreground"
              style={{ animationDelay: "120ms" }}
            >
              {t("landing.subtitle")}
            </p>
            <div className="flex animate-rise flex-col gap-3" style={{ animationDelay: "180ms" }}>
              <VerifySearch className="max-w-xl" />
              <div className="flex flex-col gap-3 xs:flex-row">
                <Button asChild size="lg">
                  <Link href="/sign-up">
                    {t("landing.primaryCta")} <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/eligibility">{t("landing.secondaryCta")}</Link>
                </Button>
              </div>
            </div>
          </div>

          {/*
            Hero licence: flips in, then drifts in 3D with a light sheen crossing the laminate and
            a contact shadow that softens as it lifts. The pointer tilts it (HeroScene --px/--py);
            status chips pop in one after another. Reduced motion keeps a still card.
          */}
          <HeroScene className="relative mx-auto w-full max-w-md px-4 py-10 [perspective:1400px] lg:max-w-[min(100%,calc((100svh-14rem)*1.45))]">
            <div
              aria-hidden
              className="absolute inset-6 -z-10 rounded-[3rem] bg-primary/20 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute inset-x-[16%] bottom-2 -z-10 h-8 animate-card-ground rounded-[50%] bg-brand/45 blur-xl dark:bg-black/70"
            />
            <div className="animate-card-in [animation-delay:150ms] [transform-style:preserve-3d]">
              <div
                className="[transform-style:preserve-3d]"
                style={{
                  transform: "rotateY(calc(var(--px) * 9deg)) rotateX(calc(var(--py) * -7deg))",
                  transition: "transform 500ms cubic-bezier(0.2, 0, 0, 1)",
                }}
              >
                <div className="relative animate-card-drift [transform-style:preserve-3d]">
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
                    <div className="absolute inset-0 rounded-[1.75rem] shadow-[inset_0_1px_0_rgb(255_255_255/0.28)]" />
                  </div>
                </div>
              </div>
            </div>
            <div
              aria-hidden
              className="absolute top-1 left-0 sm:-left-6"
              style={parallaxStyle(-14)}
            >
              <span className="block animate-pop [animation-delay:900ms]">
                <span className="flex animate-float items-center gap-2 rounded-2xl bg-card px-3 py-2 text-sm font-semibold raised">
                  <span className="inline-flex size-7 items-center justify-center rounded-lg bg-success-soft text-success">
                    <ScanLine className="size-4" />
                  </span>
                  {t("landing.scene.verified")}
                </span>
              </span>
            </div>
            <div
              aria-hidden
              className="absolute right-0 -bottom-6 sm:-right-6 sm:bottom-0"
              style={parallaxStyle(-20)}
            >
              <span className="block animate-pop [animation-delay:1150ms]">
                <span className="flex animate-float items-center gap-3 rounded-2xl bg-card px-3 py-2 raised [animation-delay:-3s]">
                  <ProgressRing value={1} total={1} tone="good" className="size-9" thickness={4}>
                    <Check className="size-4 text-success" strokeWidth={3} />
                  </ProgressRing>
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm font-semibold">
                      {t("status.application.LICENSE_ISSUED")}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("landing.scene.time")}</span>
                  </span>
                </span>
              </span>
            </div>
          </HeroScene>
        </div>
      </section>

      {/* How it works: an interactive, auto-playing diagram of the four steps. */}
      <section className="bg-sunken" aria-labelledby="steps-title">
        <div className="container-page flex flex-col gap-10 py-20 sm:gap-12 sm:py-28 lg:py-32">
          <div className="flex flex-col gap-2">
            <h2 id="steps-title">{t("landing.stepsTitle")}</h2>
            <SketchUnderline className="h-2.5 w-32 sm:h-3 sm:w-40" />
          </div>
          <JourneyDiagram />
        </div>
      </section>

      {/* Categories: the interactive ladder replaces eight text cards. */}
      <section
        className="container-page flex flex-col gap-10 py-20 sm:gap-12 sm:py-28 lg:py-32"
        aria-labelledby="ladder-title"
      >
        <div className="flex flex-col gap-2">
          <h2 id="ladder-title">{t("landing.categoriesTitle")}</h2>
          <p className="text-muted-foreground">{t("landing.categoriesSubtitle")}</p>
        </div>
        <CategoryLadder />
      </section>

      <section
        className="container-page pb-20 sm:pb-28 lg:pb-32"
        aria-label={t("landing.trustTitle")}
      >
        <ul className="grid gap-3 sm:grid-cols-3">
          {TRUST.map(({ key, icon: Icon }, index) => (
            <Reveal key={key} stagger={index}>
              <li className="spotlight flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm font-medium">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-link raised">
                  <Icon className="size-5" aria-hidden />
                </span>
                {t(`landing.trust.${key}`)}
              </li>
            </Reveal>
          ))}
        </ul>
      </section>
    </>
  );
}
