import { Check, Info, Minus, ShieldCheck } from "@/components/icons";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CAPABILITIES, CAPABILITY_GROUPS, CAPABILITY_META, requiresMfa } from "@rebp/contracts";
import { ProgressRing } from "@/components/access/progress-ring";
import { RoleChip } from "@/components/access/role-chip";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { capabilityKey } from "@/config/roles";
import { cn } from "@/lib/utils";
import { userCapabilities } from "@/server/access/permissions";
import { requireCapability } from "@/server/auth/guards";
import { SettingsTabs } from "@/components/layout/settings-tabs";
import { HeroCompanion, SettingsHero } from "@/components/layout/settings-hero";
import { AccountAvatar } from "@/components/profile/account-avatar";
import { ProfileBuddy } from "@/components/profile/profile-buddy";
import { accountAvatar } from "@/server/profile/documents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("myAccess"))("title") };
}

/** SEC-004 transparency: every user can see their own roles and effective permissions. */
export default async function MyAccessPage() {
  // Staff only: applicant-side accounts are sent to /forbidden (their permissions are fixed).
  const { user } = await requireCapability("backoffice.access", {
    allowPendingMfa: true,
    allowIncompleteProfile: true,
  });
  const t = await getTranslations();
  const [held, avatar] = await Promise.all([userCapabilities(user), accountAvatar(user)]);
  const capabilities = new Set(held);
  const bubble = t("myAccess.hero.bubble", { count: capabilities.size });

  return (
    <>
      <SettingsHero
        avatar={
          <AccountAvatar
            name={user.fullName}
            percent={avatar.percent}
            photoHref={avatar.photoHref}
            label={
              avatar.percent === null
                ? user.fullName
                : t("profile.progress", { percent: avatar.percent })
            }
          />
        }
        title={t("myAccess.title")}
        description={t("myAccess.hero.status", {
          roles: user.roles.map((role) => t(`roles.${role}`)).join(", "),
          count: capabilities.size,
          total: CAPABILITIES.length,
        })}
        companion={
          <HeroCompanion
            bubble={bubble}
            label={`${bubble}. ${t("myAccess.hero.action")}`}
            href="#my-capabilities-section"
          >
            <ProfileBuddy mood="badge" />
          </HeroCompanion>
        }
      />
      <SettingsTabs current="myAccess" />

      <section className="flex flex-col gap-4" aria-labelledby="my-roles">
        <h2 id="my-roles" className="text-xl">
          {t("myAccess.rolesTitle")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 @3xl/main:grid-cols-3">
          {user.roles.map((role) => (
            <li key={role}>
              <Card className="h-full gap-2 p-4 sm:p-5">
                <RoleChip role={role} size="md" />
                <p className="text-sm text-muted-foreground">{t(`roleInfo.${role}`)}</p>
              </Card>
            </li>
          ))}
        </ul>
        {requiresMfa(user.roles) && (
          <Alert variant="info">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-4" aria-hidden /> {t("myAccess.mfa")}
            </span>
          </Alert>
        )}
      </section>

      <section
        id="my-capabilities-section"
        className="flex scroll-mt-24 flex-col gap-4"
        aria-labelledby="my-capabilities"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="my-capabilities" className="text-xl">
            {t("myAccess.canTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("myAccess.count", { count: capabilities.size, total: CAPABILITIES.length })}
          </p>
        </div>
        <div className="grid gap-4 @2xl/main:grid-cols-2">
          {CAPABILITY_GROUPS.map((group) => {
            const caps = CAPABILITIES.filter((c) => CAPABILITY_META[c].group === group);
            const held = caps.filter((c) => capabilities.has(c)).length;
            return (
              <Card key={group} className="gap-4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ProgressRing value={held} total={caps.length} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      {held}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base">{t(`capabilityGroups.${group}`)}</h3>
                    <p className="text-xs text-muted-foreground">
                      {held} / {caps.length}
                    </p>
                  </div>
                </div>
                <ul className="flex flex-col gap-2">
                  {caps.map((cap) => {
                    const ok = capabilities.has(cap);
                    const key = capabilityKey(cap);
                    return (
                      <li
                        key={cap}
                        data-testid={`my-cap-${cap}`}
                        data-granted={ok}
                        className={cn(
                          "flex items-start gap-2.5 rounded-xl p-2",
                          ok ? "bg-primary/[0.06] dark:bg-primary/[0.12]" : "text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                            // A soft primary tick (UX-031), the app's one "done" colour.
                            ok
                              ? "bg-primary-soft text-link ring-1 ring-primary/30"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {ok ? (
                            <Check className="size-3" strokeWidth={2.5} />
                          ) : (
                            <Minus className="size-3" />
                          )}
                          <span className="sr-only">
                            {ok
                              ? t("access.matrix.legend.granted")
                              : t("access.matrix.legend.denied")}
                          </span>
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {t(`capabilities.${key}.label` as "capabilities.audit_view.label")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t(
                              `capabilities.${key}.description` as "capabilities.audit_view.description",
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden /> {t("myAccess.requestNote")}
        </p>
      </section>
    </>
  );
}
