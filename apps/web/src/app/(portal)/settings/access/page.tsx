import { Check, Info, Minus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CAPABILITIES, CAPABILITY_GROUPS, CAPABILITY_META, requiresMfa } from "@rebp/contracts";
import { ProgressRing } from "@/components/access/progress-ring";
import { RoleChip } from "@/components/access/role-chip";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { capabilityKey } from "@/config/roles";
import { cn } from "@/lib/utils";
import { userCapabilities } from "@/server/access/permissions";
import { requireUser } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("myAccess"))("title") };
}

/** SEC-004 transparency: every user can see their own roles and effective permissions. */
export default async function MyAccessPage() {
  const { user } = await requireUser({ allowPendingMfa: true });
  const t = await getTranslations();
  const capabilities = new Set(await userCapabilities(user));

  return (
    <>
      <PageHeader title={t("myAccess.title")} description={t("myAccess.subtitle")} />

      <section className="flex flex-col gap-4" aria-labelledby="my-roles">
        <h2 id="my-roles" className="text-xl">
          {t("myAccess.rolesTitle")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <section className="flex flex-col gap-4" aria-labelledby="my-capabilities">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="my-capabilities" className="text-xl">
            {t("myAccess.canTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("myAccess.count", { count: capabilities.size, total: CAPABILITIES.length })}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
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
                          ok ? "bg-success-soft" : "text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                            ok
                              ? "bg-success text-white dark:text-background"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {ok ? (
                            <Check className="size-3" strokeWidth={3} />
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
