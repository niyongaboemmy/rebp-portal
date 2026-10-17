import { getTranslations } from "next-intl/server";
import { LinkTabs } from "@/components/ui/link-tabs";
import { accountLinksFor } from "@/config/navigation";
import { userCapabilities } from "@/server/access/permissions";
import { getCurrentSession } from "@/server/auth/current";
import { keepsProfile, needsProfile } from "@/server/profile/profile";

/**
 * Profile · CV · Security · My access. These left the main navigation for the account menu (ADR-011,
 * N6), so the settings pages link to each other here.
 */
export async function SettingsTabs({
  current,
}: {
  current: "profile" | "cv" | "security" | "myAccess";
}) {
  const [t, session] = await Promise.all([getTranslations("nav"), getCurrentSession()]);
  const links = accountLinksFor(session ? await userCapabilities(session.user) : [], {
    person: session ? keepsProfile(session.user) : false,
    applicant: session ? needsProfile(session.user) : false,
  });
  return (
    <LinkTabs
      label={t("account")}
      tabs={links.map((item) => {
        const Icon = item.icon;
        return {
          href: item.href,
          label: t(item.label),
          icon: <Icon aria-hidden />,
          active: item.label === current,
        };
      })}
    />
  );
}
