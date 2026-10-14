import { ArrowRight, Lock, ShieldCheck } from "@/components/icons";
import Link from "next/link";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { SocialIcon } from "@/components/ui/social-icon";
import { Logo } from "@/components/ui/logo";
import { SOCIAL, type SocialKey } from "@/config/social";
import { cn } from "@/lib/utils";
import { BackToTop } from "./back-to-top";
import { FooterCtaSlot } from "./footer-cta-slot";

const COLUMNS = [
  {
    key: "services",
    links: [
      { href: "/sign-up", key: "footer.links.apply" },
      { href: "/check", key: "nav.verify" },
      { href: "/register", key: "nav.register" },
      { href: "/categories", key: "nav.categories" },
    ],
  },
  {
    key: "help",
    links: [
      { href: "/eligibility", key: "nav.eligibility" },
      { href: "/#how", key: "landing.stepsTitle" },
      { href: "/privacy", key: "footer.privacy" },
    ],
  },
] as const;

/** Each platform's own colour, used for the hover fill and glow. */
const SOCIAL_TONE: Record<SocialKey, string> = {
  x: "[--social:#000000] dark:[--social:#2a2a2a]",
  facebook: "[--social:#1877f2]",
  instagram: "[--social:#e1306c]",
  linkedin: "[--social:#0a66c2]",
  youtube: "[--social:#ff0000]",
};

const linkClass =
  "group/link inline-flex tap-target w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground";

/**
 * Public footer: a closing call to action, then brand and trust, two link columns and the
 * social profiles (brand tiles), and a bottom bar with the rights line, a "made in Rwanda" mark
 * and back to top. Language lives in the header.
 */
export async function SiteFooter() {
  const t = await getTranslations();
  return (
    <footer className="relative mt-auto">
      {/* Closing call to action: a brand panel straddling the page/footer edge. */}
      <FooterCtaSlot>
        <div className="bg-[linear-gradient(to_bottom,transparent_50%,var(--card)_50%)]">
          <div className="container-page">
            <div className="relative isolate flex flex-col gap-6 overflow-hidden rounded-[2rem] bg-brand p-6 text-white sm:p-8 md:flex-row md:items-center md:justify-between lg:p-10">
              <div aria-hidden className="absolute inset-0 -z-10 bg-imigongo opacity-[0.07]" />
              <div
                aria-hidden
                className="absolute -top-20 right-1/4 -z-10 size-72 animate-aurora rounded-full bg-sky/40 blur-3xl"
              />
              <div
                aria-hidden
                className="absolute -bottom-24 -left-10 -z-10 size-64 animate-aurora rounded-full bg-sun/20 blur-3xl [animation-delay:-8s]"
              />
              <div className="flex max-w-xl flex-col gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {t("footer.cta.title")}
                </h2>
                <p className="text-white/80">{t("footer.cta.body")}</p>
              </div>
              <div className="flex flex-col gap-2 xs:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-white px-6 text-brand hover:bg-white/90"
                >
                  <Link href="/sign-up">
                    {t("landing.primaryCta")} <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="rounded-full text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/eligibility">{t("landing.map.eligible")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </FooterCtaSlot>

      <div className="bg-card">
        <div className="relative container-page grid grid-cols-2 gap-x-6 gap-y-10 py-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:gap-12 lg:py-16">
          {/* Brand and trust. */}
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-1">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">{t("brand.body")}</p>
            <ul className="flex flex-wrap gap-2">
              <li className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-soft-foreground">
                <ShieldCheck filled className="size-3.5" aria-hidden />
                {t("landing.eyebrow")}
              </li>
              <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                {t("footer.secure")}
              </li>
            </ul>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.key} aria-label={t(`footer.columns.${column.key}`)}>
              <h2 className="mb-2 text-xs font-bold tracking-widest text-foreground uppercase">
                {t(`footer.columns.${column.key}`)}
              </h2>
              <ul className="flex flex-col">
                {column.links.map(({ href, key }) => (
                  <li key={href}>
                    <Link href={href as Route} className={linkClass}>
                      {t(key)}
                      <ArrowRight
                        className="size-3.5 -translate-x-1 text-link opacity-0 transition-[opacity,transform] duration-(--dur-2) group-hover/link:translate-x-0 group-hover/link:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Social: brand tiles that lift and fill with the platform's colour on hover. */}
          <div className="col-span-2 flex flex-col gap-3 sm:col-span-1 lg:col-span-1">
            <h2 className="text-xs font-bold tracking-widest text-foreground uppercase">
              {t("footer.social.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("footer.social.body")}</p>
            <ul className="flex flex-wrap gap-2.5">
              {SOCIAL.map(({ key, label, href }, index) => (
                <li key={key}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("footer.social.follow", { network: label })}
                    className={cn(
                      "group/social relative inline-flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-surface-2 text-foreground/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] transition-[transform,color,background-color,box-shadow] duration-(--dur-3) ease-spring hover:-translate-y-1 hover:text-white hover:shadow-[0_10px_20px_-10px_var(--social)] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]",
                      SOCIAL_TONE[key],
                    )}
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0 scale-0 rounded-2xl bg-(--social) transition-transform duration-(--dur-3) ease-spring group-hover/social:scale-100"
                    />
                    <SocialIcon
                      name={key}
                      className="relative transition-transform duration-(--dur-3) group-hover/social:scale-110"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar. */}
      <div className="relative overflow-hidden bg-surface-2/70">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-imigongo-fade-up text-link opacity-[0.04]"
        />
        <div className="relative container-page flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {t("footer.rights", { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Flag locale="rw" className="h-3! w-4!" />
              {t("footer.madeIn")}
            </span>
            <BackToTop label={t("footer.top")} />
          </div>
        </div>
      </div>
    </footer>
  );
}
