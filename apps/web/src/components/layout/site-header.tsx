import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/logo";
import { getCurrentSession } from "@/server/auth/current";
import { AuthMenu } from "./auth-menu";
import { CommandPalette } from "./command-palette";
import { HeaderNav } from "./header-nav";
import { HeaderShell } from "./header-shell";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { ThemeSwitch } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Public header: logo · priority+ links (overflow in "⋯") · icon search · language menu ·
 * theme switch · one account button. Transparent over the landing hero, frosted with a soft
 * shadow on scroll. Below md the links move into the drawer.
 */
export async function SiteHeader() {
  const [, current] = await Promise.all([getTranslations("nav"), getCurrentSession()]);
  return (
    <HeaderShell>
      <div className="container-page flex h-16 items-center gap-2 lg:gap-4">
        <Logo className="hidden shrink-0 sm:max-md:inline-flex lg:inline-flex" />
        <Logo className="shrink-0 sm:max-md:hidden lg:hidden" showText={false} />
        <HeaderNav />
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <CommandPalette area="public" compact />
          <LanguageSwitcher className="rounded-full" />
          <ThemeSwitch />
          {current ? (
            <UserMenu name={current.user.fullName} email={current.user.email} />
          ) : (
            <AuthMenu />
          )}
          <MobileNav area="public" />
        </div>
      </div>
    </HeaderShell>
  );
}
