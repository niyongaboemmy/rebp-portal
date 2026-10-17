import type { Route } from "next";
import { CategoryTile } from "@/components/applications/category-tile";
import { applicantPhotoUrls } from "@/server/profile/documents";
import Link from "next/link";
import {
  CircleCheck,
  Copy,
  FileDown,
  Hourglass,
  Receipt,
  RotateCcw,
  Tag,
  Wallet,
} from "@/components/icons";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { PaymentStatus } from "@rebp/contracts";
import {
  ATTENTION_CHIP,
  ATTENTION_DOT,
  LIST_GROUP,
  LIST_HEAD,
  LIST_ROW,
  LIST_ROW_HOVER,
} from "@/components/admin/surfaces";
import { WaiveFeeDialog } from "@/components/admin/waive-fee-dialog";
import { PaymentStatusBadge } from "@/components/applications/status-badges";
import { BarList } from "@/components/data/bar-list";
import { ColumnChart } from "@/components/data/column-chart";
import { StatTile } from "@/components/data/stat-tile";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { PANEL } from "@/components/ui/surface";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
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
/** Payments listed before "Show all". */
const RECENT_SHOWN = 10;

export default async function FinancePage({ searchParams }: PageProps<"/backoffice/finance">) {
  const showAllPayments = (await searchParams).payments === "all";
  const { capabilities } = await requireAnyCapability(["payments.manage", "payments.view"]);
  const canManage = capabilities.includes("payments.manage");
  const [t, format, locale, report, awaiting] = await Promise.all([
    getTranslations(),
    getFormatter(),
    getLocale(),
    financialReport(),
    awaitingPayment(),
  ]);
  const awaitingPhotos = await applicantPhotoUrls(awaiting.map((a) => a.applicantId));
  const methodLabel = (key: string) =>
    t.has(`payment.methods.${key}`)
      ? t(`payment.methods.${key}` as "payment.methods.CARD")
      : t("finance.unknownMethod");

  const attention = report.outstanding + report.duplicates;

  return (
    <>
      <PageWidth wide />
      <PageHeader
        eyebrow={t("finance.header.eyebrow")}
        title={t("finance.title")}
        description={t("finance.subtitle")}
        stats={[
          {
            value: formatMoney(report.collected, "RWF", locale),
            label: t("finance.header.collected"),
          },
          {
            value: awaiting.length,
            label: t("finance.header.awaiting"),
            tone: awaiting.length > 0 ? "now" : "muted",
          },
          {
            value: report.duplicates,
            label: t("finance.header.duplicates"),
            tone: report.duplicates > 0 ? "now" : "muted",
          },
        ]}
        mood="pay"
        bubble={
          attention > 0
            ? t("finance.header.bubbleAttention", { count: attention })
            : t("finance.header.bubbleClear")
        }
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <a href="/api/exports/payments" download>
              <FileDown /> {t("finance.export")}
            </a>
          </Button>
        }
      />

      <section
        aria-label={t("backoffice.kpis")}
        className="grid grid-cols-1 gap-3 @md/main:grid-cols-2 @md/main:gap-4 @5xl/main:grid-cols-5"
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
        <StatTile
          icon={RotateCcw}
          label={t("finance.kpis.refunded")}
          value={report.refunded.amount}
          hint={t("finance.kpis.refundedHint", { count: report.refunded.count })}
          className="@md/main:col-span-2 @5xl/main:col-span-1"
        />
      </section>

      {/* FR-RPT-003: collected revenue by fee type and by month. */}
      <div className="grid items-start gap-4 @3xl/main:grid-cols-[1fr_1.4fr]">
        <section
          className={cn("flex min-w-0 flex-col gap-4", PANEL)}
          aria-labelledby="fee-types-title"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="fee-types-title" className="text-lg">
              {t("finance.revenue.byFeeType")}
            </h2>
            <span className="text-xs text-muted-foreground">{t("finance.amountUnit")}</span>
          </div>
          {report.byFeeType.every((f) => f.amount === 0) ? (
            <p className="text-sm text-muted-foreground">{t("finance.noPayments")}</p>
          ) : (
            <BarList
              label={t("finance.revenue.byFeeType")}
              items={report.byFeeType.map((f) => ({
                key: f.key,
                label: t(`finance.revenue.types.${f.key}`),
                value: f.amount,
              }))}
            />
          )}
        </section>
        <section
          className={cn("flex min-w-0 flex-col gap-4", PANEL)}
          aria-labelledby="months-title"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="months-title" className="text-lg">
              {t("finance.revenue.byMonth")}
            </h2>
            <span className="text-xs text-muted-foreground">{t("finance.revenue.last12")}</span>
          </div>
          <ColumnChart
            label={t("finance.revenue.byMonth")}
            valueLabel={t("finance.amountUnit")}
            columns={report.byMonth.map((m) => ({
              key: m.month,
              label: format.dateTime(new Date(`${m.month}-15T12:00:00Z`), { month: "short" }),
              value: m.amount,
            }))}
          />
        </section>
      </div>

      <div className="grid items-start gap-4 @3xl/main:grid-cols-[1fr_1.4fr]">
        <section
          className={cn("flex min-w-0 flex-col gap-4", PANEL)}
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
          className={cn("flex min-w-0 flex-col gap-4", PANEL)}
          aria-labelledby="awaiting-title"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {awaiting.length > 0 ? (
              <span aria-hidden className={ATTENTION_DOT} />
            ) : (
              <CircleCheck className="size-5 shrink-0 text-link" aria-hidden />
            )}
            <h2 id="awaiting-title" className="text-lg">
              {t("finance.awaiting.title")}
            </h2>
            <span className="ml-auto text-xs font-medium num text-muted-foreground">
              {t("finance.awaiting.count", { count: awaiting.length })}
            </span>
          </div>
          {awaiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("finance.awaiting.empty")}</p>
          ) : (
            <ul className={LIST_GROUP}>
              {awaiting.map((app) => (
                <li
                  key={app.id}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-2",
                    LIST_ROW,
                    LIST_ROW_HOVER,
                  )}
                >
                  <CategoryTile
                    category={app.category}
                    photo={awaitingPhotos.get(app.applicantId)}
                    size="sm"
                  />
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

      {report.recent.length === 0 ? (
        <section aria-labelledby="recent-title" className="flex flex-col gap-3">
          <h2 id="recent-title" className="sr-only">
            {t("finance.recent.title")}
          </h2>
          <EmptyState icon={Receipt} title={t("finance.noPayments")} />
        </section>
      ) : (
        <section
          aria-labelledby="recent-title"
          className={cn("flex min-w-0 flex-col gap-4", PANEL)}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="recent-title" className="text-lg">
              {t("finance.recent.title")}
            </h2>
            <span className="text-xs font-medium num text-muted-foreground">
              {t("finance.paymentsCount", { count: report.recent.length })}
            </span>
          </div>
          <ul className={LIST_GROUP}>
            <li
              aria-hidden
              className={cn(
                "hidden grid-cols-[1.3fr_1.1fr_0.9fr_0.9fr_1fr_auto] gap-3 @2xl/main:grid",
                LIST_HEAD,
              )}
            >
              <span>{t("finance.recent.reference")}</span>
              <span>{t("finance.recent.application")}</span>
              <span className="text-right">{t("finance.recent.amount")}</span>
              <span>{t("finance.recent.method")}</span>
              <span>{t("finance.recent.status")}</span>
              <span className="w-24 text-right">{t("finance.recent.receipt")}</span>
            </li>
            {(showAllPayments ? report.recent : report.recent.slice(0, RECENT_SHOWN)).map((p) => (
              <li
                key={p.id}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 @2xl/main:grid-cols-[1.3fr_1.1fr_0.9fr_0.9fr_1fr_auto] @2xl/main:items-center",
                  LIST_ROW,
                  LIST_ROW_HOVER,
                  "py-3",
                )}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-mono text-sm font-semibold">{p.reference}</span>
                  <span className="text-xs num text-muted-foreground">
                    {formatDateTime(p.paidAt ?? p.createdAt, locale)}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 text-sm @max-2xl/main:order-3">
                  <span className="truncate font-mono">{p.application.referenceNo}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t(`categories.items.${p.application.category}.name`)}
                  </span>
                </span>
                <span className="text-right text-sm font-semibold num @max-2xl/main:order-2">
                  {formatMoney(p.amount, p.currency, locale)}
                </span>
                <span className="text-sm text-muted-foreground @max-2xl/main:order-5">
                  {p.method ? methodLabel(p.method) : "—"}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 @max-2xl/main:order-4 @max-2xl/main:justify-end">
                  <PaymentStatusBadge status={p.status as PaymentStatus} />
                  {p.duplicate && (
                    <span className={ATTENTION_CHIP}>
                      <span aria-hidden className={ATTENTION_DOT} />
                      {t("finance.recent.duplicate")}
                    </span>
                  )}
                </span>
                <span className="text-right @max-2xl/main:order-6 @2xl/main:w-24">
                  {p.receiptNo ? (
                    <Button asChild variant="link" size="sm" className="h-auto px-0">
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
          {/* The latest few first (UX-033); the rest on demand, the CSV for everything. */}
          {report.recent.length > RECENT_SHOWN && (
            <Link
              href={
                (showAllPayments
                  ? "/backoffice/finance"
                  : "/backoffice/finance?payments=all") as Route
              }
              scroll={false}
              className="self-center rounded-full px-4 py-1.5 text-sm font-semibold text-link transition-colors hover:bg-primary-soft"
            >
              {showAllPayments
                ? t("finance.recent.showLess")
                : t("finance.recent.showAll", { count: report.recent.length })}
            </Link>
          )}
        </section>
      )}
    </>
  );
}
