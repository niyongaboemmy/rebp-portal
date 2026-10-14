import { CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/ui/logo";

/** Split layout: brand panel on large screens, focused single column on phones. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute -right-20 -bottom-24 size-96 rounded-full bg-accent/30 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -top-16 -left-16 size-72 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <Logo className="relative [&_span]:text-primary-foreground" />
        <div className="relative flex max-w-md flex-col gap-6">
          <h2 className="text-[clamp(1.8rem,1.2rem+1.6vw,2.6rem)]">{t("panelTitle")}</h2>
          <ul className="flex flex-col gap-3">
            {(["one", "two", "three"] as const).map((key) => (
              <li key={key} className="flex items-start gap-3 text-base opacity-95">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />{" "}
                {t(`panelPoints.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm font-medium">REBP–REG–01</p>
      </aside>
      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Logo className="lg:invisible" />
          <div className="flex items-center gap-1">
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
