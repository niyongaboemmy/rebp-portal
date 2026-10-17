import { ArrowLeft, CloudUpload, ListChecks, Lock } from "@/components/icons";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthAmbient } from "@/components/auth/auth-ambient";
import { DevModeChip } from "@/components/layout/dev-mode-chip";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeSwitch } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/ui/logo";
import { isDevMode } from "@/server/env";
import { NO_INDEX } from "@/server/seo";

export const metadata = { robots: NO_INDEX };

const POINTS = [
  { key: "one", icon: CloudUpload },
  { key: "two", icon: ListChecks },
  { key: "three", icon: Lock },
] as const;

/**
 * Auth pages share the landing page's look. From lg the page is exactly one screen tall: a calm
 * showcase (a slow orbit animation that fades back while you
 * type, three promises) stays put and only the form column scrolls. The form sits in a frosted
 * glass card. Below lg it is a single scrolling column with the form only.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="group/auth relative isolate grid min-h-dvh lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden lg:has-[form[data-wide]]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:has-[form[data-wide]]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-80 bg-imigongo-fade text-link opacity-[0.05]"
      />

      {/* Showcase (lg+): the same story the landing hero tells. */}
      <aside className="relative hidden h-dvh flex-col justify-between gap-6 overflow-hidden p-10 lg:flex xl:p-14">
        <Logo />
        <AuthAmbient />
        <ul className="flex flex-col gap-3 [@media(max-height:760px)]:hidden">
          {POINTS.map(({ key, icon: Icon }, i) => (
            <li
              key={key}
              className="flex animate-rise items-center gap-3 text-sm text-muted-foreground"
              style={{ animationDelay: `${300 + i * 80}ms` }}
            >
              <Icon className="size-4 shrink-0 text-link" aria-hidden />
              {t(`auth.panelPoints.${key}`)}
            </li>
          ))}
        </ul>
      </aside>

      <div className="relative flex flex-col lg:h-dvh lg:overflow-y-auto lg:overscroll-contain">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-2 bg-background/60 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2">
            <Logo className="lg:hidden" showText={false} />
            <Link
              href="/"
              className="group inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
            >
              <ArrowLeft
                className="size-4 transition-transform group-hover:-translate-x-0.5"
                aria-hidden
              />
              {t("nav.home")}
            </Link>
          </div>
          <div className="flex items-center gap-1">
            {isDevMode() && <DevModeChip />}
            <LanguageSwitcher className="rounded-full" />
            <ThemeSwitch />
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="flex flex-1 items-start justify-center px-3 pt-2 pb-10 outline-none xs:px-4 sm:px-6 sm:pt-6 md:items-center lg:px-8 xl:px-10 [@media(max-height:720px)]:pt-2 [@media(max-height:720px)]:pb-6"
        >
          <div className="relative w-full max-w-[28rem] transition-[max-width] has-[form[data-wide]]:max-w-[40rem]">
            {/* A soft brand glow behind the card. */}
            <div
              aria-hidden
              className="absolute inset-x-0 -inset-y-8 -z-10 rounded-[3rem] bg-primary/15 blur-3xl sm:-inset-x-8 dark:bg-primary/20"
            />
            <div className="animate-rise rounded-[2rem] bg-white/70 p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.8),inset_0_0_0_1px_rgb(255_255_255/0.5),0_24px_60px_-28px_oklch(0.3_0.12_264/0.45)] backdrop-blur-2xl backdrop-saturate-150 xs:p-6 sm:p-8 dark:bg-[oklch(0.19_0.022_265/0.72)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_0_0_1px_rgb(255_255_255/0.05),0_28px_64px_-28px_rgb(0_0_0/0.9)] [@media(max-height:720px)]:sm:p-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
