import { AlertTriangle, Copy, FileDown, Tag, Hourglass, Receipt, Wallet } from "@/components/icons";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { PaymentStatus } from "@rebp/contracts";
import { WaiveFeeDialog } from "@/components/admin/waive-fee-dialog";
import { PaymentStatusBadge } from "@/components/applications/status-badges";
import { BarList } from "@/components/data/bar-list";
import { StatTile } from "@/components/data/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime, formatMoney } from "@/lib/format";
import { awaitingPayment, requireAnyCapability } from "@/server/backoffice/admin-queries";
import { financialReport } from "@/server/backoffice/reports";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance"))("title") };
}

/**
 * Finance console (WP-2.5, FR-PAY-008/010/011): collections and waivers at a glance, recent
 * payments with receipts and duplicate flags, fee waivers for applications awaiting payment
 * (payments.manage only) and the payments CSV export. payments.view may read.
 */
export default async function FinancePage() {
  const { capabilities } = await requireAnyCapability(["payments.manage", "payments.view"]);
  const canManage = capabilities.includes("payments.manage");
  const [t, locale, report, awaiting] = await Promise.all([
    getTranslations(),
    getLocale(),
    financialReport(),
    awaitingPayment(),
  ]);
  const methodLabel = (key: string) =>
    t.has(`payment.methods.${key}`)
      ? t(`payment.methods.${key}` as "payment.methods.CARD")
      : t("finance.unknownMethod");

  return (
    <>
      <PageWidth wide />
      <PageHeader
        title={t("finance.title")}
        description={t("finance.subtitle")}
        actions={
          <Button asChild variant="outline">
            <a href="/api/exports/payments" download>
              <FileDown /> {t("finance.export")}
            </a>
          </Button>
        }
      />

      <section
        aria-label={t("backoffice.kpis")}
        className="grid grid-cols-2 gap-3 sm:gap-4 @5xl/main:grid-cols-4"
      >
        <StatTile
          icon={Wallet}
          label={t("finance.kpis.collected")}
          value={report.collected}
          hint={t("finance.kpis.collectedHint", { count: report.paidCount })}
        />
        <StatTile
          icon={Tag}
          label={t("finance.kpis.waived")}
          value={report.waived.amount}
          hint={t("finance.kpis.waivedHint", { count: report.waived.count })}
        />
        <StatTile
          icon={Copy}
          label={t("finance.kpis.duplicates")}
          value={report.duplicates}
          hint={t("finance.kpis.duplicatesHint")}
        />
        <StatTile
          icon={Hourglass}
          label={t("finance.kpis.outstanding")}
          value={report.outstanding}
          hint={t("finance.kpis.outstandingHint")}
        />
      </section>

      <div className="grid items-start gap-4 @3xl/main:grid-cols-[1fr_1.4fr]">
        <section
          className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
          aria-labelledby="methods-title"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="methods-title" className="text-lg">
              {t("finance.byMethod")}
            </h2>
            <span className="text-xs text-muted-foreground">{t("finance.amountUnit")}</span>
          </div>
          {report.byMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("finance.noPayments")}</p>
          ) : (
            <BarList
              label={t("finance.byMethod")}
              items={report.byMethod
                .slice()
                .sort((a, b) => b.amount - a.amount)
                .map((m) => ({
                  key: m.key,
                  label: `${methodLabel(m.key)} · ${t("finance.paymentsCount", { count: m.count })}`,
                  value: m.amount,
                }))}
            />
          )}
        </section>

        <section
          className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
          aria-labelledby="awaiting-title"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="awaiting-title" className="text-lg">
              {t("finance.awaiting.title")}
            </h2>
            <span className="text-xs text-muted-foreground">
              {t("finance.awaiting.count", { count: awaiting.length })}
            </span>
          </div>
          {awaiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("finance.awaiting.empty")}</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {awaiting.map((app) => (
                <li
                  key={app.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-2 py-2.5 hover:bg-surface-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-mono text-sm font-semibold">{app.referenceNo}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {app.applicantName} · {t(`categories.items.${app.category}.name`)} ·{" "}
                      {t(`applicationTypes.${app.type}.name`)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold num">
                    {formatMoney(app.amount, "RWF", locale)}
                  </span>
                  {canManage && (
                    <WaiveFeeDialog
                      applicationId={app.id}
                      referenceNo={app.referenceNo}
                      amountLabel={formatMoney(app.amount, "RWF", locale)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="recent-title" className="flex flex-col gap-3">
        <h2 id="recent-title" className="text-lg">
          {t("finance.recent.title")}
        </h2>
        {report.recent.length === 0 ? (
          <EmptyState icon={Receipt} title={t("finance.noPayments")} />
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl border bg-card raised">
            <li
              aria-hidden
              className="hidden grid-cols-[1.3fr_1.1fr_0.9fr_0.9fr_1fr_auto] gap-3 border-b bg-surface-2 px-4 py-2 text-xs font-semibold text-muted-foreground @2xl/main:grid"
            >
              <span>{t("finance.recent.reference")}</span>
              <span>{t("finance.recent.application")}</span>
              <span className="text-right">{t("finance.recent.amount")}</span>
              <span>{t("finance.recent.method")}</span>
              <span>{t("finance.recent.status")}</span>
              <span className="w-24 text-right">{t("finance.recent.receipt")}</span>
            </li>
            {report.recent.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 @2xl/main:grid @2xl/main:grid-cols-[1.3fr_1.1fr_0.9fr_0.9fr_1fr_auto] @2xl/main:items-center @2xl/main:gap-3"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-mono text-sm font-semibold">{p.reference}</span>
                  <span className="text-xs num text-muted-foreground">
                    {formatDateTime(p.paidAt ?? p.createdAt, locale)}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 text-sm">
                  <span className="truncate font-mono">{p.application.referenceNo}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t(`categories.items.${p.application.category}.name`)}
                  </span>
                </span>
                <span className="text-sm font-semibold num @2xl/main:text-right">
                  {formatMoney(p.amount, p.currency, locale)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {p.method ? methodLabel(p.method) : "—"}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <PaymentStatusBadge status={p.status as PaymentStatus} />
                  {p.duplicate && (
                    <Badge variant="danger">
                      <AlertTriangle aria-hidden /> {t("finance.recent.duplicate")}
                    </Badge>
                  )}
                </span>
                <span className="@2xl/main:w-24 @2xl/main:text-right">
                  {p.receiptNo ? (
                    <Button asChild variant="link" size="sm">
                      <a href={`/api/files/receipt/${p.id}`} target="_blank" rel="noopener">
                        <Receipt /> {t("finance.recent.view")}
                        <span className="sr-only"> {p.receiptNo}</span>
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
