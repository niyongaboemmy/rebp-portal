import { AppShell } from "@/components/layout/app-shell";
import { requireCapability } from "@/server/auth/guards";

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireCapability("backoffice.access");
  return (
    <AppShell
      area="backoffice"
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
