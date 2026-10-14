import type { Role } from "@rebp/contracts";
import { Logo } from "@/components/ui/logo";
import { userCapabilities } from "@/server/access/permissions";
import { AppNav } from "./app-nav";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { PilotBanner } from "./pilot-banner";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

interface AppShellProps {
  area: "portal" | "backoffice";
  user: { fullName: string; email: string; roles: Role[] };
  children: React.ReactNode;
}

/**
 * Authenticated layout. Desktop (≥ lg): fixed sidebar. Mobile: top bar with a drawer.
 * Content is constrained for readability on ultra-wide screens (UX-001).
 */
export async function AppShell({ area, user, children }: AppShellProps) {
  const capabilities = await userCapabilities(user);
  return (
    <div className="flex min-h-dvh flex-col">
      <PilotBanner />
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-sidebar p-4 lg:flex">
          <Logo className="px-1 pt-1" />
          <AppNav area={area} capabilities={capabilities} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6">
            <MobileNav area={area} capabilities={capabilities} />
            <Logo className="lg:hidden" showText={false} />
            <div className="ml-auto flex items-center gap-1">
              <LanguageSwitcher />
              <ThemeToggle />
              <UserMenu name={user.fullName} email={user.email} />
            </div>
          </header>
          <main
            id="main"
            className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-10"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
