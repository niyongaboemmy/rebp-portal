import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  FileText,
  Languages,
  Lock,
  Timer,
  UserPlus,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { CATEGORY_INFO } from "@rebp/contracts";
import { CategoryLadder } from "@/components/categories/category-ladder";
import { LicenceCard } from "@/components/licence/licence-card";
import { Reveal } from "@/components/motion/reveal";
import { VerifySearch } from "@/components/register/verify-search";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { publicPageMetadata, siteUrl } from "@/server/seo";

const STEPS = [
  { key: "account", icon: UserPlus },
  { key: "apply", icon: FileText },
  { key: "pay", icon: CreditCard },
  { key: "license", icon: BadgeCheck },
] as const;

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

          <div
            className="relative mx-auto w-full max-w-md animate-pop lg:max-w-none"
            style={{ animationDelay: "200ms" }}
          >
            <div
              aria-hidden
              className="absolute -inset-6 -z-10 rounded-[3rem] bg-primary/10 blur-3xl"
            />
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
            />
          </div>
        </div>
      </section>

      {/* How it works: four icons joined by a line that draws in. Titles only. */}
      <section className="border-y bg-card" aria-labelledby="steps-title">
        <div className="container-page flex flex-col gap-8 py-14">
          <h2 id="steps-title">{t("landing.stepsTitle")}</h2>
          <ol className="relative grid gap-6 sm:grid-cols-4">
            <span
              aria-hidden
              className="absolute top-6 right-[12.5%] left-[12.5%] hidden h-0.5 origin-left animate-[meter-in_1.2s_var(--ease-enter)_both] bg-gradient-to-r from-primary via-sky to-sun sm:block"
            />
            {STEPS.map(({ key, icon: Icon }, index) => (
              <Reveal key={key} stagger={index}>
                <li className="relative flex items-center gap-4 sm:flex-col sm:text-center">
                  <span className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
                    <Icon className="size-5" aria-hidden />
                    <span className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-sun text-[0.65rem] font-bold num text-sun-foreground">
                      {index + 1}
                    </span>
                  </span>
                  <span className="text-base font-semibold">{t(`landing.steps.${key}.title`)}</span>
                </li>
              </Reveal>
            ))}
          </ol>
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
              <li className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm font-medium">
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
