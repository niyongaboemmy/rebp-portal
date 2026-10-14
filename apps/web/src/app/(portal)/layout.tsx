import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/server/auth/guards";

/**
 * Shell for the applicant portal. Layouts don't re-run on client navigation,
 * so every page also calls its own guard; this one only loads the user for the chrome.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser({ allowPendingMfa: true });
  return (
    <AppShell
      area="portal"
      user={{ fullName: user.fullName, email: user.email, roles: user.roles }}
    >
      {children}
    </AppShell>
  );
}
