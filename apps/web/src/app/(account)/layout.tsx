import { AppShell } from "@/components/layout/app-shell";
import { userCan } from "@/server/access/permissions";
import { requireUser } from "@/server/auth/guards";

/**
 * Shell for the account pages (Profile, CV, Security, My access). They belong to the person, not
 * to an area, so they open in the area the person works in: staff stay in the back office,
 * applicants in the portal. Each page still calls its own guard (layouts don't re-run).
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser({ allowPendingMfa: true });
  const staff = await userCan(user, "backoffice.access");
  return (
    <AppShell
      area={staff ? "backoffice" : "portal"}
      user={{
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        roles: user.roles,
        accountType: user.accountType,
      }}
    >
      {children}
    </AppShell>
  );
}
