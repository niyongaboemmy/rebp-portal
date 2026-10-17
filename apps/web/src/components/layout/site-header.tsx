import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/logo";
import { getCurrentSession } from "@/server/auth/current";
import { userCapabilities } from "@/server/access/permissions";
import { profilePhotoUrl } from "@/server/profile/documents";
import { keepsProfile, needsProfile } from "@/server/profile/profile";
import { AuthMenu } from "./auth-menu";
import { CommandPalette } from "./command-palette";
import { HeaderNav } from "./header-nav";
import { HeaderShell } from "./header-shell";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { ThemeSwitch } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Public header, three columns: logo · centred one-word links (overflow in "⋯") · icon search,
 * flag language menu, theme switch and one account button. Transparent over the landing hero, frosted with a soft
 * shadow on scroll. Below md the links move into the drawer.
 */
export async function SiteHeader() {
  const [, current] = await Promise.all([getTranslations("nav"), getCurrentSession()]);
  const [photoUrl, capabilities] = current
    ? await Promise.all([profilePhotoUrl(current.user.id), userCapabilities(current.user)])
    : [null, []];
  return (
    <HeaderShell>
      <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <div className="col-start-1 flex items-center justify-self-start">
          <Logo className="hidden sm:max-md:inline-flex lg:inline-flex" />
          <Logo className="sm:max-md:hidden lg:hidden" showText={false} />
        </div>
        <HeaderNav />
        <div className="col-start-3 flex items-center gap-0.5 justify-self-end sm:gap-1">
          <CommandPalette area="public" compact />
          <LanguageSwitcher className="rounded-full" />
          <ThemeSwitch />
          {current ? (
            <UserMenu
              name={current.user.fullName}
              email={current.user.email}
              photoUrl={photoUrl}
              person={keepsProfile(current.user)}
              applicant={needsProfile(current.user)}
              capabilities={capabilities}
            />
          ) : (
            <AuthMenu />
          )}
          <MobileNav />
        </div>
      </div>
    </HeaderShell>
  );
}
