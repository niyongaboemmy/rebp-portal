import { ArrowRight, Lock, Timer } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CategoryMap } from "@/components/categories/category-map";
import { HeroGuide } from "@/components/landing/hero-guide";
import { HeroVisual } from "@/components/landing/hero-visual";
import { VerifyLaunch } from "@/components/landing/verify-launch";
import { JourneyDiagram } from "@/components/landing/journey-diagram";
import { SketchUnderline } from "@/components/motion/sketch-underline";
import { Reveal } from "@/components/motion/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { publicPageMetadata, siteUrl } from "@/server/seo";

/** The applicant's path, shown under the hero actions (FR-PORTAL-006 eligibility first). */
const GUIDE = [
  { key: "eligibility", href: "/eligibility" },
  { key: "apply", href: "/sign-up" },
  { key: "licence", href: "#how" },
] as const;

const TRUST = [{ key: "secure" }, { key: "live" }, { key: "languages" }] as const;

/** The trust banner's small live graphics (decorative; the text carries the meaning). */
function TrustGraphic({ kind }: { kind: (typeof TRUST)[number]["key"] }) {
  if (kind === "secure")
    return <Lock filled className="size-7 animate-lock-click text-white" aria-hidden />;
  if (kind === "live")
    return (
      <>
        <span
          aria-hidden
          className="absolute inset-1.5 animate-[spin_3s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,transparent_0_60%,var(--sun))] [mask:radial-gradient(closest-side,transparent_calc(100%-3px),#000_calc(100%-2px))]"
        />
        <Timer className="size-6 text-white" aria-hidden />
        <span aria-hidden className="absolute top-2 right-2 flex size-2.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-success/80" />
          <span className="relative size-2.5 rounded-full bg-success ring-2 ring-brand" />
        </span>
      </>
    );
  return (
    <span aria-hidden className="h-6 overflow-hidden">
      <span className="flex animate-lang-cycle flex-col">
        {(["en", "rw", "fr", "en"] as const).map((locale, index) => (
          <span key={index} className="flex h-6 items-center gap-1.5">
            <Flag locale={locale} className="h-4! w-[1.35rem]! ring-white/30" />
            <span className="font-mono text-xs font-bold uppercase">{locale}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return publicPageMetadata({ path: "/", title: t("homeTitle"), description: t("description") });
}

export default async function LandingPage() {
  const t = await getTranslations();
  const base = siteUrl();

  return (
    <div className="flex flex-1 flex-col">
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
          {/*
            Hero copy, minimal and guided, in the brand blue: an official badge, a compact headline
            whose words resolve in turn (the accent phrase in primary with the Sun double underline
            used on every section title), one line of copy, two actions and a three-step guide.
            Vertical rhythm scales with viewport height. The register is reached through a button,
            not a form on the landing page, so crawlers and bots have nothing to submit. No shadows;
            every loop stops under reduced motion.
          */}
          <div className="relative z-10 flex max-w-2xl min-w-0 flex-col">
            <span className="inline-flex w-fit animate-rise items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-foreground">
              <span className="relative flex size-1.5" aria-hidden>
                <span className="absolute inset-0 animate-ping rounded-full bg-ember/70" />
                <span className="relative size-1.5 rounded-full bg-ember" />
              </span>
              {t("landing.eyebrow")}
            </span>

            <h1 className="mt-[clamp(1rem,3vh,1.75rem)] text-[clamp(2.1rem,min(4.3vw,6.6vh),3.9rem)] leading-[1.08] font-bold tracking-[-0.035em] text-balance hyphens-none">
              {t("landing.titleLead")
                .split(" ")
                .map((word, index) => (
                  <span
                    key={index}
                    className="inline-block animate-word-in"
                    style={{ animationDelay: `${80 + index * 90}ms` }}
                  >
                    {word}&nbsp;
                  </span>
                ))}
              <span
                className="relative inline-block animate-word-in text-link"
                style={{
                  animationDelay: `${80 + t("landing.titleLead").split(" ").length * 90}ms`,
                }}
              >
                {t("landing.titleAccent")}
                <SketchUnderline className="absolute -bottom-[0.3em] left-0 h-[0.28em] w-[85%] sm:h-[0.28em] sm:w-[85%]" />
              </span>
            </h1>
            <p
              className="mt-[clamp(1.1rem,3vh,1.75rem)] animate-rise text-[clamp(1rem,min(1.3vw,2vh),1.125rem)] text-muted-foreground"
              style={{ animationDelay: "380ms" }}
            >
              {t("landing.subtitle")}
            </p>

            <div
              className="mt-[clamp(1.5rem,4.5vh,2.75rem)] flex animate-rise flex-col gap-3 xs:flex-row xs:flex-wrap xs:items-center"
              style={{ animationDelay: "480ms" }}
            >
              <Button asChild size="lg" className="rounded-full px-6">
                <Link href="/sign-up">
                  {t("landing.primaryCta")} <ArrowRight />
                </Link>
              </Button>
              <VerifyLaunch label={t("nav.verify")} className="w-full xs:w-fit" />
            </div>

            <HeroGuide
              label={t("landing.guide.label")}
              className="mt-[clamp(1.5rem,5vh,3rem)]"
              steps={GUIDE.map((step) => ({
                key: step.key,
                href: step.href,
                label: t(`landing.guide.${step.key}`),
              }))}
            />
          </div>

          {/* Below lg the stage comes first (visual, then the message); beside the copy from lg. */}
          <HeroVisual className="max-lg:order-first lg:max-w-[min(100%,calc((100svh-14rem)*1.45))]" />
        </div>
      </section>

      {/* How it works: an interactive, auto-playing diagram of the four steps. */}
      <section id="how" className="scroll-mt-20 bg-sunken" aria-labelledby="steps-title">
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
          <SketchUnderline className="h-2.5 w-32 sm:h-3 sm:w-40" />
          <p className="text-muted-foreground">{t("landing.categoriesSubtitle")}</p>
        </div>
        <CategoryMap />
      </section>

      {/*
        Trust banner: one brand panel, three promises. Each is a short title and one line, led
        by a small live graphic: a lock that clicks shut, a timer ring that keeps turning with a
        live dot, and flags cycling through the three languages. Stacks on phones; loops stop
        under reduced motion.
      */}
      <section
        className="container-page pb-20 sm:pb-28 lg:pb-32"
        aria-label={t("landing.trustTitle")}
      >
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-brand text-white">
          <div aria-hidden className="absolute inset-0 -z-10 bg-imigongo opacity-[0.07]" />
          <div
            aria-hidden
            className="absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-sky/40 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-28 left-1/3 -z-10 size-64 rounded-full bg-sun/20 blur-3xl"
          />
          <ul className="grid divide-white/10 max-md:divide-y md:grid-cols-3 md:divide-x">
            {TRUST.map(({ key }, index) => (
              <li key={key}>
                <Reveal stagger={index}>
                  <div className="group flex items-center gap-4 p-5 sm:p-6 lg:gap-5 lg:p-8">
                    <span className="relative inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/12 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-transform duration-(--dur-3) ease-spring group-hover:scale-105 group-hover:-rotate-3 lg:size-16">
                      <TrustGraphic kind={key} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-base font-semibold tracking-tight lg:text-lg">
                        {t(`landing.trustItems.${key}.title`)}
                      </span>
                      <span className="text-sm text-white/75">
                        {t(`landing.trustItems.${key}.body`)}
                      </span>
                    </span>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
