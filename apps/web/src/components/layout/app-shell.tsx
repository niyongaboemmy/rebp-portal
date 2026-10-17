import { getTranslations } from "next-intl/server";
import type { Role } from "@rebp/contracts";
import { Logo } from "@/components/ui/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { canSwitchArea, type AppArea } from "@/config/navigation";
import { userCapabilities } from "@/server/access/permissions";
import { navBadges } from "@/server/nav-badges";
import { profilePhotoUrl } from "@/server/profile/documents";
import { needsProfile } from "@/server/profile/profile";
import { readShellPrefs } from "@/server/shell-prefs";
import { AccountSheet, SidebarAccountMenu } from "./account-menu";
import { AppNav } from "./app-nav";
import { AreaSwitcher } from "./area-switcher";
import { BottomNav } from "./bottom-nav";
import { BreadcrumbProvider, Breadcrumbs } from "./breadcrumbs";
import { CommandPalette } from "./command-palette";
import { HelpMenu } from "./help-menu";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";
import { PilotBanner } from "./pilot-banner";
import { RecentPagesTracker } from "./recent-pages-tracker";
import { TopBar } from "./top-bar";

interface AppShellProps {
  area: AppArea;
  user: {
    id: string;
    fullName: string;
    email: string;
    roles: Role[];
    accountType: "INDIVIDUAL" | "ORGANISATION";
  };
  children: React.ReactNode;
}

/** The role shown under the name: a staff role when there is one, otherwise "Applicant". */
function primaryRole(roles: Role[]): Role {
  return roles.find((role) => role !== "APPLICANT") ?? "APPLICANT";
}

/**
 * Authenticated shell (ADR-011, UX-001): a full-height sidebar on a dimmer plane and the page as
 * one inset panel beside it, with the top bar inside the panel.
 * - phones (< md): top bar + bottom tab bar;
 * - md–lg: icon rail, the trigger opens the full sidebar as a sheet;
 * - ≥ lg: collapsible sidebar (auto: collapsed below xl), remembered in the `rebp_shell` cookie.
 * The sidebar, top bar and tab bar are pinned during view transitions; only content moves.
 */
export async function AppShell({ area, user, children }: AppShellProps) {
  const [capabilities, prefs, t, photoUrl] = await Promise.all([
    userCapabilities(user),
    readShellPrefs(),
    getTranslations("roles"),
    profilePhotoUrl(user.id),
  ]);
  const badges = await navBadges(user.id, area, capabilities);
  const account = {
    user: {
      fullName: user.fullName,
      email: user.email,
      roleLabel: t(primaryRole(user.roles)),
      photoUrl,
      hasProfile: needsProfile(user),
    },
    area,
    canSwitchArea: canSwitchArea(capabilities),
    capabilities,
  };

  return (
    <SidebarProvider
      initialPrefs={prefs}
      className="flex min-h-dvh bg-sidebar print:bg-transparent"
    >
      <BreadcrumbProvider>
        <Sidebar>
          <SidebarHeader>
            <Logo className="px-1 sb-collapsed:px-0" textClassName="sb-collapsed:sr-only" />
            {account.canSwitchArea && <AreaSwitcher area={area} />}
          </SidebarHeader>
          <SidebarContent>
            <AppNav area={area} capabilities={capabilities} badges={badges} />
          </SidebarContent>
          <SidebarFooter>
            <SidebarAccountMenu {...account} />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2 print:p-0">
          <div className="ambient flex flex-1 flex-col md:overflow-clip md:rounded-2xl md:border md:border-border print:rounded-none print:border-0">
            <TopBar>
              <Logo className="md:hidden" showText={false} />
              <SidebarTrigger className="-ml-1" />
              <Breadcrumbs
                area={area}
                capabilities={capabilities}
                className="hidden flex-1 md:block"
              />
              <div className="ml-auto flex items-center gap-1">
                <CommandPalette
                  area={area}
                  capabilities={capabilities}
                  recentKey={user.id}
                  className="md:mr-1 md:w-52 md:min-w-0 xl:w-72"
                />
                <LanguageSwitcher className="hidden md:inline-flex" />
                <NotificationBell />
                <HelpMenu />
                <AccountSheet {...account} />
              </div>
            </TopBar>
            <main
              id="main"
              className="@container/main mx-auto flex w-full max-w-(--content-max) flex-1 flex-col gap-6 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:gap-8 sm:px-6 sm:pt-6 md:pb-10 lg:px-8"
            >
              {/* Inside the content, under the top bar, so the bar shares the logo row's baseline (A3). */}
              <PilotBanner className="rounded-xl print:hidden" />
              {children}
            </main>
          </div>
        </div>

        <BottomNav area={area} capabilities={capabilities} badges={badges} />
        <RecentPagesTracker storageKey={user.id} />
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
