import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { getCurrentSession } from "@/server/auth/current";
import { CommandPalette } from "./command-palette";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { PublicNav } from "./public-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const [t, current] = await Promise.all([getTranslations("nav"), getCurrentSession()]);
  return (
    <header
      style={{ viewTransitionName: "app-header" }}
      className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
    >
      <div className="container-page flex h-16 items-center gap-2">
        <MobileNav area="public" />
        <Logo className="mr-2 hidden sm:inline-flex lg:mr-4" />
        <Logo className="sm:hidden" showText={false} />
        <PublicNav />
        <div className="ml-auto flex items-center gap-1">
          <CommandPalette area="public" className="md:min-w-0 lg:min-w-48" />
          <LanguageSwitcher />
          <ThemeToggle className="hidden xs:inline-flex" />
          {current ? (
            <UserMenu name={current.user.fullName} email={current.user.email} />
          ) : (
            <>
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link href="/sign-in">{t("signIn")}</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">{t("signUp")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
