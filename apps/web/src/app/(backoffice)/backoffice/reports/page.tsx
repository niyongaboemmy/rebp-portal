import {
  BadgeCheck,
  Building2,
  ClipboardCheck,
  Copy,
  FileDown,
  Hourglass,
  MessageSquare,
  Scale,
  Tag,
  Timer,
  Wallet,
} from "@/components/icons";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { ICON_TILE } from "@/components/admin/surfaces";
import { BarList } from "@/components/data/bar-list";
import { ColumnChart } from "@/components/data/column-chart";
import { DistributionBar } from "@/components/data/distribution-bar";
import { ProgressRing } from "@/components/data/progress-ring";
import { StatTile } from "@/components/data/stat-tile";
import { Button } from "@/components/ui/button";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { PANEL } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { userCapabilities } from "@/server/access/permissions";
import { requireCapability } from "@/server/auth/guards";
import {
  financialReport,
  operationalReport,
  reasonsReport,
  registerReport,
} from "@/server/backoffice/reports";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("reports"))("title") };
}

const byCount = <T extends { count: number }>(rows: T[]) =>
  rows.slice().sort((a, b) => b.count - a.count);

function ChartCard({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      // min-w-0: a grid item may shrink below its chart's min-content width (no sideways scroll at 320 px).
      className={cn("flex min-w-0 flex-col gap-4", PANEL)}
      aria-labelledby={id}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={id} className="text-lg">
          {title}
        </h3>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** A report section's title: a soft medallion and the heading (the icon is rendered here, on the server). */
function SectionTitle({
  id,
  icon,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="flex items-center gap-3 text-xl">
      <span aria-hidden className={cn(ICON_TILE, "size-9")}>
        {icon}
      </span>
      {children}
    </h2>
  );
}

/**
 * Reports (WP-4.5, FR-RPT-001…005): operational throughput and SLA, the register at a glance and,
 * for payments.view, collections. Aggregates only; row-level data leaves only through the audited
 * CSV exports.
 */
export default async function ReportsPage() {
  const { user } = await requireCapability("reports.view");
  const capabilities = await userCapabilities(user);
  const canSeePayments = capabilities.includes("payments.view");
  // The applications export is for regulator staff, not firm users (see /api/exports).
  const canExportApplications = capabilities.includes("backoffice.access");

  const [t, format, ops, register, reasons, finance] = await Promise.all([
    getTranslations(),
    getFormatter(),
    operationalReport(),
    registerReport(),
    reasonsReport(),
    canSeePayments ? financialReport() : null,
  ]);
  const reasonLabel = (code: string) =>
    t.has(`review.reasonCodes.${code}`)
      ? t(`review.reasonCodes.${code}` as "review.reasonCodes.OTHER")
      : code;
  const sla = Math.round(ops.slaCompliance * 100);
  const infoRate = Math.round(ops.infoRequestRate * 100);
  const activeLicences = register.byCategory.reduce((sum, c) => sum + c.count, 0);
  const none = (
    <p className="rounded-2xl bg-foreground/[0.025] px-4 py-6 text-center text-sm text-muted-foreground dark:bg-white/[0.03]">
      {t("reports.noData")}
    </p>
  );

  return (
    <>
      <PageWidth wide />
      <PageHeader
        eyebrow={t("reports.header.eyebrow")}
        title={t("reports.title")}
        description={t("reports.subtitle")}
        stats={[
          { value: ops.open, label: t("reports.header.open") },
          {
            value: ops.breached,
            label: t("reports.header.breached"),
            tone: ops.breached > 0 ? "now" : "muted",
          },
          { value: activeLicences, label: t("reports.header.licences") },
        ]}
        mood={ops.breached > 0 ? "waiting" : "documents"}
        bubble={t("reports.header.bubble", { sla })}
        actions={
          (canExportApplications || canSeePayments) && (
            <div className="flex flex-wrap gap-2">
              {canExportApplications && (
                <Button asChild variant="outline" className="rounded-full">
                  <a href="/api/exports/applications" download>
                    <FileDown /> {t("reports.exportApplications")}
                  </a>
                </Button>
              )}
              {canExportApplications && (
                <Button asChild variant="outline" className="rounded-full">
                  <a href="/api/exports/applications-by-reason" download>
                    <FileDown /> {t("reports.exportReasons")}
                  </a>
                </Button>
              )}
              {canSeePayments && (
                <Button asChild variant="outline" className="rounded-full">
                  <a href="/api/exports/payments" download>
                    <FileDown /> {t("reports.exportPayments")}
                  </a>
                </Button>
              )}
            </div>
          )
        }
      />

      {/* Operational (FR-RPT-001/002) */}
      <section aria-labelledby="ops-title" className="flex flex-col gap-4">
        <SectionTitle id="ops-title" icon={<ClipboardCheck />}>
          {t("reports.operational.title")}
        </SectionTitle>
        <div className="grid grid-cols-1 gap-3 @md/main:grid-cols-2 @md/main:gap-4 @5xl/main:grid-cols-4">
          <StatTile
            icon={ClipboardCheck}
            label={t("reports.operational.submitted")}
            value={ops.submitted}
            hint={t("reports.operational.open", { count: ops.open })}
          />
          <StatTile
            icon={Timer}
            label={t("reports.operational.sla")}
            value={sla}
            format="percent"
            hint={t("reports.operational.breached", { count: ops.breached })}
            graphic={
              <ProgressRing
                value={sla}
                total={100}
                tone={sla >= 90 ? "good" : sla >= 75 ? "warning" : "critical"}
                className="size-11"
              />
            }
          />
          <StatTile
            icon={MessageSquare}
            label={t("reports.operational.infoRate")}
            value={infoRate}
            format="percent"
            hint={t("reports.operational.infoRateHint")}
          />
          <StatTile
            icon={Scale}
            label={t("reports.operational.overrides")}
            value={ops.overridden}
            hint={t("reports.operational.overridesHint")}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-4 @3xl/main:grid-cols-2">
          <ChartCard id="decisions-title" title={t("reports.operational.decisions")}>
            {ops.decisions.length === 0 ? (
              none
            ) : (
              <DistributionBar
                label={t("reports.operational.decisions")}
                segments={byCount(ops.decisions).map((d) => ({
                  key: d.key,
                  label: t(`decision.types.${d.key as "APPROVED"}`),
                  value: d.count,
                }))}
              />
            )}
          </ChartCard>
          <ChartCard
            id="throughput-title"
            title={t("reports.operational.throughput")}
            aside={t("reports.last30")}
          >
            {ops.throughput.length === 0 ? (
              none
            ) : (
              <BarList
                label={t("reports.operational.throughput")}
                items={ops.throughput.map((o) => ({ key: o.key, label: o.key, value: o.count }))}
              />
            )}
          </ChartCard>
          <ChartCard id="status-title" title={t("reports.operational.byStatus")}>
            {ops.byStatus.length === 0 ? (
              none
            ) : (
              <BarList
                label={t("reports.operational.byStatus")}
                items={byCount(ops.byStatus).map((s) => ({
                  key: s.key,
                  label: t(`status.application.${s.key as "DRAFT"}`),
                  value: s.count,
                }))}
              />
            )}
          </ChartCard>
          <div className="flex flex-col gap-4">
            <ChartCard id="category-title" title={t("reports.operational.byCategory")}>
              {ops.byCategory.length === 0 ? (
                none
              ) : (
                <BarList
                  label={t("reports.operational.byCategory")}
                  items={byCount(ops.byCategory).map((c) => ({
                    key: c.key,
                    label: t(`categories.items.${c.key as "REA"}.name`),
                    value: c.count,
                  }))}
                />
              )}
            </ChartCard>
            <ChartCard id="type-title" title={t("reports.operational.byType")}>
              {ops.byType.length === 0 ? (
                none
              ) : (
                <DistributionBar
                  label={t("reports.operational.byType")}
                  segments={byCount(ops.byType).map((c) => ({
                    key: c.key,
                    label: t(`applicationTypes.${c.key as "NEW"}.name`),
                    value: c.count,
                  }))}
                />
              )}
            </ChartCard>
          </div>
        </div>
      </section>

      {/* Rejection reasons and recommendations (FR-RPT-001) */}
      <section aria-labelledby="reasons-title" className="flex flex-col gap-4">
        <SectionTitle id="reasons-title" icon={<Scale />}>
          {t("reports.reasons.title")}
        </SectionTitle>
        <div className="grid grid-cols-1 items-start gap-4 @3xl/main:grid-cols-2 @6xl/main:grid-cols-3">
          <ChartCard
            id="rejection-reasons-title"
            title={t("reports.reasons.rejectionReasons")}
            aside={t("reports.reasons.rejectionsHint", {
              rejections: reasons.rejections,
              deferrals: reasons.deferrals,
            })}
          >
            {reasons.rejectionReasons.length === 0 ? (
              none
            ) : (
              <BarList
                label={t("reports.reasons.rejectionReasons")}
                items={reasons.rejectionReasons.map((r) => ({
                  key: r.key,
                  label: reasonLabel(r.key),
                  value: r.count,
                }))}
              />
            )}
          </ChartCard>
          <ChartCard
            id="recommendations-title"
            title={t("reports.reasons.recommendations")}
            aside={t("reports.reasons.signedReviews")}
          >
            {reasons.recommendations.length === 0 ? (
              none
            ) : (
              <DistributionBar
                label={t("reports.reasons.recommendations")}
                segments={reasons.recommendations.map((r) => ({
                  key: r.key,
                  label: t.has(`review.recommendations.${r.key}.label`)
                    ? t(
                        `review.recommendations.${r.key}.label` as "review.recommendations.APPROVE.label",
                      )
                    : r.key,
                  value: r.count,
                }))}
              />
            )}
          </ChartCard>
          <ChartCard
            id="review-reasons-title"
            title={t("reports.reasons.reviewReasons")}
            aside={t("reports.reasons.reviewReasonsHint")}
          >
            {reasons.reviewReasons.length === 0 ? (
              none
            ) : (
              <BarList
                label={t("reports.reasons.reviewReasons")}
                items={reasons.reviewReasons.map((r) => ({
                  key: r.key,
                  label: reasonLabel(r.key),
                  value: r.count,
                }))}
              />
            )}
          </ChartCard>
        </div>
      </section>

      {/* Register (FR-RPT-002) */}
      <section aria-labelledby="register-title" className="flex flex-col gap-4">
        <SectionTitle id="register-title" icon={<BadgeCheck />}>
          {t("reports.register.title")}
        </SectionTitle>
        <div className="grid grid-cols-1 gap-3 @md/main:grid-cols-2 @md/main:gap-4 @5xl/main:grid-cols-3">
          <StatTile
            icon={BadgeCheck}
            label={t("reports.register.active")}
            value={activeLicences}
            hint={t("reports.register.activeHint")}
          />
          <StatTile
            icon={Hourglass}
            label={t("reports.register.expiring")}
            value={register.expiring}
            hint={t("reports.register.expiringHint")}
          />
          <StatTile
            icon={Building2}
            label={t("reports.register.firms")}
            value={register.firms}
            hint={t("reports.register.firmsHint")}
            className="@md/main:col-span-2 @5xl/main:col-span-1"
          />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 @3xl/main:grid-cols-2">
          <ChartCard id="reg-category-title" title={t("reports.register.byCategory")}>
            {register.byCategory.length === 0 ? (
              none
            ) : (
              <BarList
                label={t("reports.register.byCategory")}
                items={byCount(register.byCategory).map((c) => ({
                  key: c.key,
                  label: t(`categories.items.${c.key as "REA"}.name`),
                  value: c.count,
                }))}
              />
            )}
          </ChartCard>
          <ChartCard id="reg-status-title" title={t("reports.register.byStatus")}>
            {register.byStatus.length === 0 ? (
              none
            ) : (
              <DistributionBar
                label={t("reports.register.byStatus")}
                segments={byCount(register.byStatus).map((s) => ({
                  key: s.key,
                  label: t(`status.licence.${s.key as "ACTIVE"}`),
                  value: s.count,
                }))}
              />
            )}
          </ChartCard>
        </div>
      </section>

      {/* Financial (FR-RPT-003, payments.view) */}
      {finance && (
        <section aria-labelledby="finance-title" className="flex flex-col gap-4">
          <SectionTitle id="finance-title" icon={<Wallet />}>
            {t("reports.financial.title")}
          </SectionTitle>
          <div className="grid grid-cols-1 gap-3 @md/main:grid-cols-2 @md/main:gap-4 @5xl/main:grid-cols-4">
            <StatTile
              icon={Wallet}
              label={t("finance.kpis.collected")}
              value={finance.collected}
              hint={t("finance.kpis.collectedHint", { count: finance.paidCount })}
            />
            <StatTile
              icon={Tag}
              label={t("finance.kpis.waived")}
              value={finance.waived.amount}
              hint={t("finance.kpis.waivedHint", { count: finance.waived.count })}
            />
            <StatTile
              icon={Copy}
              label={t("finance.kpis.duplicates")}
              value={finance.duplicates}
              hint={t("finance.kpis.duplicatesHint")}
            />
            <StatTile
              icon={Hourglass}
              label={t("finance.kpis.outstanding")}
              value={finance.outstanding}
              hint={t("finance.kpis.outstandingHint")}
            />
          </div>
          <div className="grid grid-cols-1 items-start gap-4 @3xl/main:grid-cols-[1fr_1.4fr]">
            <ChartCard
              id="fee-types-title"
              title={t("finance.revenue.byFeeType")}
              aside={t("finance.amountUnit")}
            >
              {finance.byFeeType.every((f) => f.amount === 0) ? (
                none
              ) : (
                <BarList
                  label={t("finance.revenue.byFeeType")}
                  items={finance.byFeeType.map((f) => ({
                    key: f.key,
                    label: t(`finance.revenue.types.${f.key}`),
                    value: f.amount,
                  }))}
                />
              )}
            </ChartCard>
            <ChartCard
              id="months-title"
              title={t("finance.revenue.byMonth")}
              aside={t("finance.revenue.last12")}
            >
              <ColumnChart
                label={t("finance.revenue.byMonth")}
                valueLabel={t("finance.amountUnit")}
                columns={finance.byMonth.map((m) => ({
                  key: m.month,
                  label: format.dateTime(new Date(`${m.month}-15T12:00:00Z`), {
                    month: "short",
                  }),
                  value: m.amount,
                }))}
              />
            </ChartCard>
          </div>
          <ChartCard
            id="methods-title"
            title={t("finance.byMethod")}
            aside={t("finance.amountUnit")}
          >
            {finance.byMethod.length === 0 ? (
              none
            ) : (
              <BarList
                label={t("finance.byMethod")}
                items={finance.byMethod
                  .slice()
                  .sort((a, b) => b.amount - a.amount)
                  .map((m) => ({
                    key: m.key,
                    label: t.has(`payment.methods.${m.key}`)
                      ? t(`payment.methods.${m.key}` as "payment.methods.CARD")
                      : t("finance.unknownMethod"),
                    value: m.amount,
                  }))}
              />
            )}
          </ChartCard>
        </section>
      )}
    </>
  );
}
