import { CloudUpload, ListChecks, Lock } from "@/components/icons";
import { getFormatter, getTranslations } from "next-intl/server";
import { CATEGORY_INFO } from "@rebp/contracts";
import { DevModeChip } from "@/components/layout/dev-mode-chip";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LicenceCard } from "@/components/licence/licence-card";
import { Logo } from "@/components/ui/logo";
import { isDevMode } from "@/server/env";
import { NO_INDEX, siteUrl } from "@/server/seo";

export const metadata = { robots: NO_INDEX };

const POINTS = [
  { key: "one", icon: CloudUpload },
  { key: "two", icon: ListChecks },
  { key: "three", icon: Lock },
] as const;

/** Split layout: brand panel (the outcome — a licence) on large screens, focused form on phones. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative isolate hidden overflow-hidden bg-brand p-10 lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute inset-0 -z-10 bg-imigongo text-white opacity-[0.06]" />
        <Logo className="relative [&_span]:text-white" />
        <div className="relative flex max-w-md flex-col gap-8">
          <h2 className="text-[clamp(1.8rem,1.2rem+1.6vw,2.6rem)] text-white">
            {t("auth.panelTitle")}
          </h2>
          <LicenceCard
            holder="Aline Uwase"
            categoryName={t("categories.items.FSLA.name")}
            section={CATEGORY_INFO.FSLA.section}
            licenceNo="RL-2026-000123"
            statusLabel={t("status.licence.ACTIVE")}
            expiryLabel={t("licence.expires")}
            expiry={format.dateTime(new Date("2027-10-14"), { dateStyle: "medium" })}
            verifyUrl={`${siteUrl()}/check/SAMPLE`}
            sampleLabel={t("licence.sample")}
            className="animate-pop [animation-delay:150ms]"
          />
          <ul className="flex flex-wrap gap-2">
            {POINTS.map(({ key, icon: Icon }, i) => (
              <li
                key={key}
                className="inline-flex animate-rise items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-sm font-medium text-white backdrop-blur"
                style={{ animationDelay: `${300 + i * 60}ms` }}
              >
                <Icon className="size-4 shrink-0" aria-hidden /> {t(`auth.panelPoints.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm font-medium text-white/90">REBP–REG–01</p>
      </aside>
      <div className="relative isolate flex flex-col">
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-64 bg-ambient lg:hidden" />
        <header className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Logo className="lg:invisible" />
          <div className="flex items-center gap-1">
            {isDevMode() && <DevModeChip />}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main"
          className="flex flex-1 items-start justify-center px-4 pt-4 pb-12 sm:items-center sm:px-6"
        >
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
