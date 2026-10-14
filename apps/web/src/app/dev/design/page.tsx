import { CheckCircle2, FileStack, Inbox, ShieldCheck, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { APPLICATION_STATUS_TONES, JOURNEY_STAGES, LICENSE_STATUS_TONES } from "@rebp/contracts";
import { BarList } from "@/components/data/bar-list";
import { ColumnChart } from "@/components/data/column-chart";
import { DistributionBar } from "@/components/data/distribution-bar";
import { Meter } from "@/components/data/meter";
import { ProgressRing } from "@/components/data/progress-ring";
import { Sparkline } from "@/components/data/sparkline";
import { StatTile } from "@/components/data/stat-tile";
import { StateJourney } from "@/components/data/state-journey";
import { StatusTimeline } from "@/components/data/status-timeline";
import { ValidityRing } from "@/components/data/validity-ring";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/ui/copy-field";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard, SkeletonStat } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { isDevMode } from "@/server/env";

export const dynamic = "force-dynamic";

const SWATCHES = [
  "background",
  "card",
  "surface-2",
  "surface-3",
  "brand",
  "primary",
  "link",
  "primary-soft",
  "sun",
  "ember",
  "ember-soft",
  "sky",
  "success",
  "warning",
  "destructive",
  "muted-foreground",
  "border",
  "input",
] as const;

/**
 * APP_ENV=dev living style guide (ADR-009): every token and component state in the current
 * theme. Values are illustrative sample data, never shown to users.
 */
export default async function DesignPage() {
  if (!isDevMode()) notFound();
  const t = await getTranslations();
  const days = [3, 5, 2, 8, 6, 9, 4, 7, 12, 10, 6, 11, 14, 9];

  return (
    <main id="main" className="container-page flex flex-col gap-10 py-10">
      <h1>{t("design.title")}</h1>

      <section className="flex flex-col gap-3">
        <h2>{t("design.colours")}</h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {SWATCHES.map((name) => (
            <li key={name} className="flex flex-col gap-1.5 text-xs">
              <span className="h-14 rounded-xl border" style={{ background: `var(--${name})` }} />
              <code>--{name}</code>
            </li>
          ))}
        </ul>
        <ul className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <li
              key={n}
              className="size-8 rounded-lg"
              style={{ background: `var(--chart-${n})` }}
              title={`--chart-${n}`}
            />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2>{t("design.buttons")}</h2>
        <div className="flex flex-wrap gap-2">
          <Button>{t("common.continue")}</Button>
          <Button variant="tonal">{t("common.save")}</Button>
          <Button variant="outline">{t("common.back")}</Button>
          <Button variant="ghost">{t("common.cancel")}</Button>
          <Button variant="destructive">{t("common.remove")}</Button>
          <Button loading>{t("common.loading")}</Button>
          <Button size="fab">
            <FileStack /> {t("placeholders.applicationsCta")}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2>{t("design.status")}</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(APPLICATION_STATUS_TONES).map(([status, tone]) => (
            <StatusBadge
              key={status}
              tone={tone}
              label={t(`status.application.${status as "DRAFT"}`)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(LICENSE_STATUS_TONES).map(([status, tone]) => (
            <StatusBadge
              key={status}
              tone={tone}
              size="lg"
              label={t(`status.licence.${status as "ACTIVE"}`)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2>{t("design.data")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={UsersRound}
            label={t("backoffice.accounts")}
            value={1284}
            hint="+32"
            graphic={<Sparkline points={days} />}
          />
          <StatTile
            icon={ShieldCheck}
            label={t("backoffice.twoStep")}
            value={72}
            format="percent"
            graphic={<ProgressRing value={72} total={100} tone="warning" className="size-11" />}
          />
          <StatTile icon={Inbox} label={t("nav.queue")} value={38} />
          <SkeletonStat />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex items-center gap-6 rounded-2xl border bg-card p-5">
            <ValidityRing daysLeft={45} unit="days" label="45 days left" />
            <ValidityRing daysLeft={210} unit="days" label="210 days left" />
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
            <Meter label="REA" value={2} max={3} target={3} tone="warning" valueText="2 / 3" />
            <Meter label="Ratio" value={7} max={10} valueText="7 / 10" />
            <StateJourney stages={JOURNEY_STAGES} current={3} label="Review" />
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <DistributionBar
              label="Queue"
              segments={[
                { key: "a", label: "New", value: 12 },
                { key: "b", label: "Review", value: 18 },
                { key: "c", label: "Waiting", value: 6 },
                { key: "d", label: "Decision", value: 4 },
              ]}
            />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5">
            <ColumnChart
              label="Activity"
              valueLabel="events"
              columns={days.map((value, i) => ({ key: String(i), label: String(i + 1), value }))}
            />
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <BarList
              label="Roles"
              items={[
                { key: "a", label: t("roles.APPLICANT"), value: 940 },
                { key: "b", label: t("roles.SUPERVISOR"), value: 120 },
                { key: "c", label: t("roles.REVIEWING_OFFICER"), value: 14 },
              ]}
            />
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <StatusTimeline
            responsive
            steps={[
              {
                key: "1",
                title: t("status.application.SUBMITTED"),
                meta: "02/10/2026",
                state: "done",
              },
              {
                key: "2",
                title: t("status.application.UNDER_REVIEW"),
                meta: "05/10/2026",
                state: "done",
              },
              {
                key: "3",
                title: t("status.application.ACTION_REQUIRED"),
                meta: "≤ 30 d",
                state: "current",
                tone: "warning",
              },
              { key: "4", title: t("status.application.PENDING_DECISION"), state: "upcoming" },
              { key: "5", title: t("status.application.LICENSE_ISSUED"), state: "upcoming" },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <CopyField label="Reference" value="APP-2026-004211" size="lg" />
        <SkeletonCard />
        <EmptyState
          icon={CheckCircle2}
          title={t("dashboard.noLicence")}
          description={t("placeholders.licensesBody")}
        />
      </section>
    </main>
  );
}
