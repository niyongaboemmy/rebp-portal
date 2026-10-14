import type { Role } from "@rebp/contracts";
import { Logo } from "@/components/ui/logo";
import { userCapabilities } from "@/server/access/permissions";
import { AppNav } from "./app-nav";
import { BottomNav } from "./bottom-nav";
import { CommandPalette } from "./command-palette";
import { LanguageSwitcher } from "./language-switcher";
import { PilotBanner } from "./pilot-banner";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

interface AppShellProps {
  area: "portal" | "backoffice";
  user: { fullName: string; email: string; roles: Role[] };
  children: React.ReactNode;
}

/**
 * Adaptive authenticated layout (UX-001):
 * - phones (< md): compact top bar + bottom tab bar with "More";
 * - tablets (md–lg): navigation rail;
 * - desktop (≥ lg): full sidebar.
 * Header, rail/sidebar and tab bar are pinned during view transitions; only content moves.
 */
export async function AppShell({ area, user, children }: AppShellProps) {
  const capabilities = await userCapabilities(user);
  return (
    <div className="flex min-h-dvh flex-col">
      <PilotBanner />
      <div className="flex flex-1">
        <aside
          style={{ viewTransitionName: "app-sidebar" }}
          className="sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-r bg-sidebar md:flex md:w-22 md:items-center md:gap-5 md:px-2 md:py-4 lg:w-68 lg:items-stretch lg:gap-6 lg:p-4"
        >
          <Logo className="hidden px-1 pt-1 lg:inline-flex" />
          <Logo className="lg:hidden" showText={false} />
          <div className="hidden lg:block">
            <AppNav area={area} capabilities={capabilities} />
          </div>
          <div className="lg:hidden">
            <AppNav area={area} capabilities={capabilities} variant="rail" />
          </div>
        </aside>
        <div className="relative isolate flex min-w-0 flex-1 flex-col">
          {/* The landing page's ambient light and Imigongo fade, behind every page's header. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 opacity-80 bg-ambient"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-imigongo-fade text-link opacity-[0.04]"
          />
          <header
            style={{ viewTransitionName: "app-header" }}
            className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-card/85 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 sm:px-6"
          >
            <Logo className="md:hidden" showText={false} />
            <CommandPalette area={area} capabilities={capabilities} className="md:ml-0" />
            <div className="ml-auto flex items-center gap-1">
              <LanguageSwitcher className="hidden md:inline-flex" />
              <ThemeToggle className="hidden md:inline-flex" />
              <UserMenu name={user.fullName} email={user.email} />
            </div>
          </header>
          <main
            id="main"
            className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:gap-8 sm:px-6 sm:pt-8 md:pb-10 lg:px-10"
          >
            {children}
          </main>
        </div>
      </div>
      <BottomNav
        area={area}
        capabilities={capabilities}
        user={{ fullName: user.fullName, email: user.email }}
      />
    </div>
  );
}
