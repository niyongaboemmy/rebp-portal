import {
  Activity,
  ArrowRight,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { BarList } from "@/components/data/bar-list";
import { ColumnChart } from "@/components/data/column-chart";
import { ProgressRing } from "@/components/data/progress-ring";
import { Sparkline } from "@/components/data/sparkline";
import { StatTile } from "@/components/data/stat-tile";
import { PageHeader } from "@/components/ui/page-header";
import { BACKOFFICE_SECTIONS } from "@/config/navigation";
import { userCapabilities } from "@/server/access/permissions";
import { requireCapability } from "@/server/auth/guards";
import { accountStats, auditActivity } from "@/server/backoffice/overview";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("backoffice") };
}

/**
 * Back-office overview (FR-RPT-001, FR-ADM-005): role-aware KPI tiles and charts from live
 * data, then shortcuts to each console. Each metric is shown only to roles whose capabilities
 * cover the underlying data (access.view for accounts, audit.view for the audit trail).
 */
export default async function BackofficeOverview() {
  const { user } = await requireCapability("backoffice.access");
  const [t, format, capabilities] = await Promise.all([
    getTranslations(),
    getFormatter(),
    userCapabilities(user),
  ]);
  const canSeeAccounts = capabilities.includes("access.view");
  const canSeeAudit = capabilities.includes("audit.view");
  const [accounts, activity] = await Promise.all([
    canSeeAccounts ? accountStats() : null,
    canSeeAudit ? auditActivity() : null,
  ]);
  const sections = Object.entries(BACKOFFICE_SECTIONS).filter(([, s]) =>
    capabilities.includes(s.capability),
  );
  const dayLabel = (day: string) =>
    format.dateTime(new Date(`${day}T12:00:00Z`), { day: "numeric", month: "short" });
  const twoStepShare =
    accounts && accounts.total > 0 ? Math.round((accounts.withTwoStep / accounts.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title={t("nav.backoffice")}
        description={user.roles.map((r) => t(`roles.${r}`)).join(" · ")}
      />

      {accounts && (
        <section
          aria-label={t("backoffice.kpis")}
          className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
        >
          <StatTile
            icon={UsersRound}
            label={t("backoffice.accounts")}
            value={accounts.total}
            hint={t("backoffice.newThisWeek", { count: accounts.newThisWeek })}
            graphic={<Sparkline points={accounts.signUps.map((d) => d.count)} />}
            href="/backoffice/access"
          />
          <StatTile
            icon={MonitorSmartphone}
            label={t("backoffice.sessions")}
            value={accounts.activeSessions}
            hint={t("backoffice.sessionsHint")}
          />
          <StatTile
            icon={ShieldCheck}
            label={t("backoffice.twoStep")}
            value={twoStepShare}
            format="percent"
            hint={t("backoffice.twoStepHint", { count: accounts.withTwoStep })}
            graphic={
              <ProgressRing
                value={accounts.withTwoStep}
                total={accounts.total}
                tone={twoStepShare >= 80 ? "good" : "warning"}
                className="size-11"
              />
            }
          />
          {activity && (
            <StatTile
              icon={Activity}
              label={t("backoffice.events")}
              value={activity.reduce((sum, d) => sum + d.count, 0)}
              hint={t("backoffice.last14")}
              href="/backoffice/audit"
            />
          )}
        </section>
      )}

      {(activity || accounts) && (
        <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
          {activity && (
            <section
              className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
              aria-labelledby="activity-title"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="activity-title" className="text-lg">
                  {t("backoffice.activityTitle")}
                </h2>
                <span className="text-xs text-muted-foreground">{t("backoffice.last14")}</span>
              </div>
              <ColumnChart
                label={t("backoffice.activityTitle")}
                valueLabel={t("backoffice.eventsUnit")}
                columns={activity.map((d) => ({
                  key: d.day,
                  label: dayLabel(d.day),
                  value: d.count,
                }))}
              />
            </section>
          )}
          {accounts && (
            <section
              className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
              aria-labelledby="roles-title"
            >
              <h2 id="roles-title" className="text-lg">
                {t("backoffice.byRole")}
              </h2>
              <BarList
                label={t("backoffice.byRole")}
                items={accounts.byRole.map((r) => ({
                  key: r.role,
                  label: t(`roles.${r.role}`),
                  value: r.count,
                }))}
              />
            </section>
          )}
        </div>
      )}

      <section aria-labelledby="consoles-title" className="flex flex-col gap-3">
        <h2 id="consoles-title" className="text-lg">
          {t("backoffice.consoles")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {sections.map(([slug, s], index) => {
            const Icon = s.icon;
            return (
              <li key={slug} className="animate-rise" style={{ animationDelay: `${index * 40}ms` }}>
                <Link
                  href={`/backoffice/${slug}`}
                  className="group spotlight flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 raised transition-[border-color,transform] duration-(--dur-2) hover:border-primary/40 active:scale-[0.98]"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground transition-transform duration-(--dur-3) ease-spring group-hover:scale-110">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold">{t(`nav.${s.label}`)}</span>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-ember-text">
                    <Sparkles className="size-3" aria-hidden /> {t("common.comingSoon")}
                    <ArrowRight
                      className="ml-auto size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
