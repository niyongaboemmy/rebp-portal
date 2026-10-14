import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  FileText,
  Languages,
  Lock,
  Search,
  Timer,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CATEGORIES, CATEGORY_INFO } from "@rebp/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STEPS = [
  { key: "account", icon: UserPlus },
  { key: "apply", icon: FileText },
  { key: "pay", icon: CreditCard },
  { key: "license", icon: BadgeCheck },
] as const;

export default async function LandingPage() {
  const t = await getTranslations();

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-40 -left-24 size-72 rounded-full bg-accent/60 blur-3xl"
          aria-hidden
        />
        <div className="relative container-page grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:py-28">
          <div className="flex flex-col gap-6">
            <Badge variant="accent" className="px-3 py-1">
              <BadgeCheck /> {t("landing.eyebrow")}
            </Badge>
            <h1 className="text-[clamp(2.1rem,1.4rem+3.4vw,4rem)]">{t("landing.title")}</h1>
            <p className="max-w-xl text-lg text-muted-foreground">{t("landing.subtitle")}</p>
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

          <form
            action="/register"
            method="get"
            className="flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-soft sm:p-8"
            role="search"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                <Search className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl">{t("landing.verifyTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("landing.verifySubtitle")}</p>
              </div>
            </div>
            <label htmlFor="q" className="sr-only">
              {t("landing.verifyPlaceholder")}
            </label>
            <Input id="q" name="q" placeholder={t("landing.verifyPlaceholder")} />
            <Button type="submit" variant="secondary">
              {t("landing.verifyButton")}
            </Button>
          </form>
        </div>
      </section>

      <section className="container-page flex flex-col gap-8 py-14">
        <div className="flex flex-col gap-2">
          <h2>{t("landing.categoriesTitle")}</h2>
          <p className="text-muted-foreground">{t("landing.categoriesSubtitle")}</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((code) => (
            <li
              key={code}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold">
                  {CATEGORY_INFO[code].section}
                </span>
                <Badge variant="outline">{t(`categories.tiers.${CATEGORY_INFO[code].tier}`)}</Badge>
              </div>
              <h3 className="text-base">{t(`categories.items.${code}.name`)}</h3>
              <p className="text-sm text-muted-foreground">
                {t(`categories.items.${code}.summary`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y bg-card">
        <div className="container-page flex flex-col gap-8 py-14">
          <h2>{t("landing.stepsTitle")}</h2>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ key, icon: Icon }, index) => (
              <li key={key} className="flex flex-col gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary font-display text-lg font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-primary" aria-hidden />{" "}
                  {t(`landing.steps.${key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground">{t(`landing.steps.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page flex flex-col gap-6 py-14">
        <h2>{t("landing.trustTitle")}</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Lock, text: t("landing.trust.secure") },
            { icon: Timer, text: t("landing.trust.transparent") },
            { icon: Languages, text: t("landing.trust.accessible") },
          ].map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-5 text-sm font-medium"
            >
              <Icon className="size-5 shrink-0 text-primary" aria-hidden /> {text}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
