import { ArrowRight, BadgeCheck, Check, Languages, Lock, ScanLine, Timer } from "lucide-react";
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

      {/* Hero: search first (the most common public task), then the two applicant actions. */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-80 bg-imigongo-fade text-primary opacity-[0.05]"
        />
        <div className="container-page grid gap-10 pt-10 pb-14 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:py-24">
          <div className="flex flex-col gap-6">
            <span className="inline-flex w-fit animate-rise items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-foreground">
              <BadgeCheck className="size-3.5" aria-hidden /> {t("landing.eyebrow")}
            </span>
            <h1
              className="animate-rise text-[clamp(2rem,1.3rem+3.2vw,3.75rem)] leading-[1.05] font-extrabold tracking-[-0.035em]"
              style={{ animationDelay: "60ms" }}
            >
              {t("landing.title")}
            </h1>
            <SketchUnderline className="-mt-3" />
            <p
              className="max-w-xl animate-rise text-lg text-muted-foreground"
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
                <Button asChild size="lg" variant="tonal">
                  <Link href="/eligibility">{t("landing.secondaryCta")}</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Layered hero scene: the licence and three floating status chips, with pointer parallax. */}
          <HeroScene className="mx-auto w-full max-w-md animate-pop px-4 py-8 [animation-delay:200ms] lg:max-w-none">
            <div
              aria-hidden
              className="absolute inset-4 -z-10 rounded-[3rem] bg-primary/15 blur-3xl"
            />
            <div style={parallaxStyle(8)}>
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
            </div>
            <div
              aria-hidden
              className="absolute -top-1 left-0 sm:-left-4"
              style={parallaxStyle(-14)}
            >
              <span className="flex animate-float items-center gap-2 rounded-2xl border bg-card/90 px-3 py-2 text-sm font-semibold shadow-3 backdrop-blur">
                <span className="inline-flex size-7 items-center justify-center rounded-lg bg-success-soft text-success">
                  <ScanLine className="size-4" />
                </span>
                {t("landing.scene.verified")}
              </span>
            </div>
            <div
              aria-hidden
              className="absolute right-0 -bottom-9 sm:-right-4 sm:-bottom-2"
              style={parallaxStyle(-20)}
            >
              <span className="flex animate-float items-center gap-3 rounded-2xl border bg-card/90 px-3 py-2 shadow-3 backdrop-blur [animation-delay:-2s]">
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
            </div>
            <div
              aria-hidden
              className="absolute -bottom-6 left-6 hidden sm:block"
              style={parallaxStyle(-10)}
            >
              <span className="flex animate-float items-center gap-2 rounded-full border bg-card/90 px-3 py-1.5 text-xs font-semibold shadow-3 backdrop-blur [animation-delay:-4s]">
                <span className="size-2 animate-pulse rounded-full bg-sun" />
                {t("landing.scene.languages")}
              </span>
            </div>
          </HeroScene>
        </div>
      </section>

      {/* How it works: an interactive, auto-playing diagram of the four steps. */}
      <section className="border-y bg-card" aria-labelledby="steps-title">
        <div className="container-page flex flex-col gap-8 py-14 sm:py-20">
          <div className="flex flex-col gap-2">
            <h2 id="steps-title">{t("landing.stepsTitle")}</h2>
            <SketchUnderline className="h-2.5 w-32 sm:h-3 sm:w-40" />
          </div>
          <JourneyDiagram />
        </div>
      </section>

      {/* Categories: the interactive ladder replaces eight text cards. */}
      <section className="container-page flex flex-col gap-6 py-14" aria-labelledby="ladder-title">
        <div className="flex flex-col gap-2">
          <h2 id="ladder-title">{t("landing.categoriesTitle")}</h2>
          <p className="text-muted-foreground">{t("landing.categoriesSubtitle")}</p>
        </div>
        <CategoryLadder />
      </section>

      <section className="container-page pb-16" aria-label={t("landing.trustTitle")}>
        <ul className="grid gap-3 sm:grid-cols-3">
          {TRUST.map(({ key, icon: Icon }, index) => (
            <Reveal key={key} stagger={index}>
              <li className="spotlight flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm font-medium">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary raised">
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
