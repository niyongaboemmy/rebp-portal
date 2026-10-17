import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ApplicationStages } from "@/components/applications/application-stages";
import { PaymentForm } from "@/components/applications/payment-form";
import { PaymentStatusBadge } from "@/components/applications/status-badges";
import { ApplicationHeader } from "@/components/applications/application-header";
import { Receipt } from "@/components/icons";
import { PANEL } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { formatDateTime, formatMoney } from "@/lib/format";
import { applicationForOwner } from "@/server/applications/applications";
import { requireCapability } from "@/server/auth/guards";
import { feeQuote } from "@/server/payments/payments";
import { BreadcrumbTail } from "@/components/layout/breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payments"))("title") };
}

/** Section K payment (FR-PAY-001…004, BR-080): itemised fees, then a method, then the gateway. */
export default async function PayPage({ params }: PageProps<"/applications/[id]/pay">) {
  const { user } = await requireCapability("payments.pay");
  const { id } = await params;
  const app = await applicationForOwner(id, user);
  if (!app) notFound();
  if (app.status !== "PENDING_PAYMENT") redirect(`/applications/${app.id}`);
  const [t, tl, tc, tw, locale, quote] = await Promise.all([
    getTranslations("payments"),
    getTranslations("payment.lines"),
    getTranslations("categories.items"),
    getTranslations("wizard"),
    getLocale(),
    feeQuote(app),
  ]);
  const attempts = app.payments.filter((p) => p.status !== "PAID");

  const tb = await getTranslations("applications.detail");
  return (
    <>
      <BreadcrumbTail label={app.referenceNo} />
      <ApplicationHeader
        back={{ href: `/applications/${app.id}`, label: tb("backToApplication") }}
        title={tc(`${app.category}.name`)}
        typeLine={tw(`typeLine.${app.type}`)}
        reference={app.referenceNo}
      />
      <ApplicationStages current="pay" className="mb-4" />
      <div className="grid items-start gap-4 @3xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="fees-title" className={cn("flex flex-col gap-4", PANEL)}>
          {/* What it comes to, then the lines as one list group (UX-027). */}
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,var(--primary-soft),color-mix(in_oklch,var(--primary)_14%,var(--card)))] text-link">
              <Receipt className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col">
              <h2 id="fees-title" className="text-sm font-semibold text-muted-foreground">
                {t("breakdown")}
              </h2>
              <span className="text-2xl font-bold num">
                {formatMoney(quote.total, quote.currency, locale)}
              </span>
            </div>
          </div>
          <dl className="flex flex-col divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl text-sm ring-1 ring-foreground/[0.06] dark:divide-white/[0.06] dark:ring-white/[0.06]">
            {quote.lines.map((line) => (
              <div key={line.code} className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-muted-foreground">{tl(line.code)}</dt>
                <dd className="font-medium num">
                  {formatMoney(line.amount, quote.currency, locale)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 bg-primary/[0.04] px-4 py-3 font-bold dark:bg-white/[0.03]">
              <dt>{t("total")}</dt>
              <dd className="num">{formatMoney(quote.total, quote.currency, locale)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {t("schedule", { reference: quote.reference })}
          </p>
          {attempts.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-foreground/[0.06] pt-4 dark:border-white/[0.06]">
              <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                {t("previous")}
              </span>
              {attempts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-xs">{p.reference}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(p.createdAt, locale)}
                  </span>
                  <PaymentStatusBadge status={p.status} />
                </div>
              ))}
            </div>
          )}
        </section>
        <PaymentForm
          applicationId={app.id}
          phone={user.phone}
          total={formatMoney(quote.total, quote.currency, locale)}
        />
      </div>
    </>
  );
}
