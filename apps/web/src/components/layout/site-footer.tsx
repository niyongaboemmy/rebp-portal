import Link from "next/link";
import type { Route } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/logo";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { localisedPath } from "@/i18n/routing";

const LINKS = [
  { href: "/register", key: "nav.register" },
  { href: "/categories", key: "nav.categories" },
  { href: "/eligibility", key: "nav.eligibility" },
  { href: "/privacy", key: "footer.privacy" },
] as const;

export async function SiteFooter() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  return (
    <footer className="relative mt-auto overflow-hidden bg-card">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-imigongo-fade-up text-link opacity-[0.04]"
      />
      <div className="relative container-page flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{t("brand.body")}</p>
        </div>
        <nav aria-label={t("footer.navLabel")} className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          {LINKS.map(({ href, key }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex tap-target items-center text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(key)}
            </Link>
          ))}
        </nav>
        <nav aria-label={t("language.label")} className="flex flex-wrap gap-2">
          {LOCALES.map((code) => (
            <Link
              key={code}
              href={localisedPath(code, "/") as Route}
              // A language link is a choice, never something to fetch ahead of a click.
              prefetch={false}
              hrefLang={code}
              lang={code}
              aria-current={code === locale ? "true" : undefined}
              className="inline-flex h-11 items-center rounded-full bg-surface-2 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground aria-[current=true]:bg-foreground aria-[current=true]:text-background sm:h-9"
            >
              {LOCALE_LABELS[code].native}
            </Link>
          ))}
        </nav>
      </div>
      <div className="relative bg-surface-2/60">
        <p className="container-page py-4 text-xs text-muted-foreground">
          {t("footer.rights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
