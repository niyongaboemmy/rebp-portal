import {
  ArrowRight,
  Certificate,
  ChevronRight,
  Download,
  FileText,
  Gavel,
  History,
  ListChecks,
  RefreshCw,
  ScrollText,
  ShieldCheck,
} from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CATEGORY_INFO, renewalTiming, type DecisionCondition } from "@rebp/contracts";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { ValidityRing } from "@/components/data/validity-ring";
import { FactGrid, type Fact } from "@/components/licence/fact-grid";
import { LicenceCard } from "@/components/licence/licence-card";
import { LicenceFlags } from "@/components/licence/licence-flags";
import { LicenceHistory } from "@/components/licence/licence-history";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { daysUntil, formatDay } from "@/lib/format";
import { requireUser } from "@/server/auth/guards";
import { getConfig } from "@/server/config/config";
import { verifyUrl } from "@/server/licensing/official-documents";
import { walletLicence } from "@/server/licensing/wallet-queries";
import { dayOf, todayKigali } from "@/server/time";
import { BreadcrumbTail } from "@/components/layout/breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("wallet"))("detailTitle") };
}

const OBLIGATIONS = [
  "honesty",
  "disclosure",
  "clientMoney",
  "records",
  "scope",
  "training",
] as const;
const ARTICLE_10 = ["referOnly", "noNegotiation", "noMoney", "disclose"] as const;

/**
 * Licence detail (FR-PORTAL-003, FR-N-002/008): the wallet card with its QR, every detail on
 * the certificate, conditions and the professional obligations that come with the licence
 * (Article 10 for referral agents, FR-G1-006), supervisor and firm, status history and the
 * official documents. Only the holder can open it.
 */
export default async function LicenceDetailPage({ params }: PageProps<"/licenses/[id]">) {
  const { user } = await requireUser();
  const { id } = await params;
  const [t, locale, found, thresholds] = await Promise.all([
    getTranslations(),
    getLocale(),
    walletLicence(id, user.id),
    getConfig("thresholds"),
  ]);
  if (!found) notFound();
  const { licence, supervisor, names, replacement } = found;

  const categoryName = t(`categories.items.${licence.category}.name`);
  const days = daysUntil(licence.expiresAt);
  const live = licence.status === "ACTIVE";
  const timing = renewalTiming(
    licence.status,
    dayOf(licence.expiresAt),
    todayKigali(),
    thresholds.value,
  );
  const canRenew =
    (timing === "open" || timing === "late") && !licence.flags.includes("RENEWAL_PENDING");
  const firm = licence.firm ?? licence.affiliatedFirm;
  const scope = licence.scope.map((c) => names.get(c) ?? c).join(", ");
  const conditions = ((licence.conditions as unknown as DecisionCondition[]) ?? []).map((c) => ({
    key: `${c.code}:${c.text ?? ""}`,
    label: c.code === "CUSTOM" ? (c.text ?? "") : t(`conditions.${c.code}`),
    detail: c.code === "CUSTOM" ? undefined : c.text,
    endsOn: c.endsOn || undefined,
  }));
  const rera = licence.category === "RERA";

  const facts: Fact[] = [
    {
      key: "licenceNo",
      label: t("registerResults.fields.licenceNo"),
      value: licence.licenceNo,
      mono: true,
    },
    {
      key: "registrationNo",
      label: t("registerResults.fields.registrationNo"),
      value: licence.registrant.registrationNo,
      mono: true,
    },
    { key: "category", label: t("verification.category"), value: categoryName },
    {
      key: "status",
      label: t("wallet.status"),
      value: <LicenceStatusBadge status={licence.status} />,
    },
    { key: "issued", label: t("wallet.issuedOn"), value: formatDay(licence.issuedAt, locale) },
    { key: "expires", label: t("licence.expires"), value: formatDay(licence.expiresAt, locale) },
    ...(licence.practiceArrangement
      ? [
          {
            key: "arrangement",
            label: t("wallet.arrangement"),
            value: t(`arrangements.${licence.practiceArrangement as "AFFILIATED"}`),
          },
        ]
      : []),
    ...(firm
      ? [
          {
            key: "firm",
            label: t("registerResults.fields.firm"),
            value: firm.tradingName ?? firm.legalName,
          },
        ]
      : []),
    ...(licence.branch
      ? [
          {
            key: "branch",
            label: t("wallet.branch"),
            value: [
              licence.branch.name,
              licence.branch.district ? names.get(licence.branch.district) : null,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ]
      : []),
    ...(supervisor
      ? [
          {
            key: "supervisor",
            label: t("wallet.supervisor"),
            value: (
              <Link
                href={`/check/${encodeURIComponent(supervisor.licenceNo)}` as Route}
                className="text-link underline-offset-4 hover:underline"
              >
                {supervisor.displayName} ({supervisor.licenceNo})
              </Link>
            ),
          },
        ]
      : []),
    {
      key: "scope",
      label: t("registerResults.fields.scope"),
      value: scope || t("licence.nationwide"),
      wide: true,
    },
    {
      key: "certificate",
      label: t("wallet.certificateVersion"),
      value: t("wallet.versionValue", { version: licence.certificateVersion }),
    },
  ];

  return (
    <>
      <BreadcrumbTail label={licence.licenceNo} />
      <PageHeader
        eyebrow={licence.licenceNo}
        title={categoryName}
        description={licence.displayName}
        actions={
          <>
            {canRenew && (
              <Button asChild>
                <Link href={`/applications/new?type=RENEWAL&licence=${licence.id}` as Route}>
                  <RefreshCw /> {t("wallet.renew")}
                </Link>
              </Button>
            )}
            <Button asChild variant={canRenew ? "outline" : "default"}>
              <a href={`/api/files/certificate/${licence.id}?download=1`} download>
                <Download /> {t("wallet.downloadCertificate")}
              </a>
            </Button>
          </>
        }
      />

      {replacement && (
        <Alert variant="info" title={t("wallet.replacedTitle")}>
          <Link href={`/licenses/${replacement.id}` as Route}>
            {t("wallet.replacedBody", { number: replacement.licenceNo })}
          </Link>
        </Alert>
      )}
      <LicenceFlags flags={licence.flags} />
      {canRenew && (
        <Alert variant="warning" title={t("wallet.renew")}>
          {timing === "late"
            ? t("wallet.renewLate", { days: thresholds.value.graceDays + days })
            : t("wallet.renewOpen", { count: Math.max(0, days) })}
        </Alert>
      )}

      <div className="grid items-start gap-4 @3xl/main:grid-cols-[1fr_1.25fr]">
        <div className="flex flex-col gap-4">
          <LicenceCard
            holder={licence.displayName}
            categoryName={categoryName}
            section={CATEGORY_INFO[licence.category].section}
            licenceNo={licence.licenceNo}
            statusLabel={t(`status.licence.${licence.status}`)}
            expiryLabel={t("licence.expires")}
            expiry={formatDay(licence.expiresAt, locale)}
            verifyUrl={verifyUrl(licence.qrToken)}
            className="animate-rise"
          />

          {live && (
            <section
              aria-labelledby="validity-title"
              className="flex items-center gap-5 rounded-3xl border bg-card p-5 raised sm:p-6"
            >
              <ValidityRing
                daysLeft={days}
                unit={t("wallet.daysUnit")}
                label={t("wallet.daysLeft", { count: Math.max(0, days) })}
                className="size-20 shrink-0"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <h2 id="validity-title" className="text-lg">
                  {t("wallet.validityTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("wallet.expiresOn", { date: formatDay(licence.expiresAt, locale) })}
                </p>
              </div>
            </section>
          )}

          <section
            aria-labelledby="documents-title"
            className="flex flex-col gap-3 rounded-3xl border bg-card p-5 raised sm:p-6"
          >
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-link" aria-hidden />
              <h2 id="documents-title" className="text-lg">
                {t("wallet.documentsTitle")}
              </h2>
            </div>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href={`/api/files/certificate/${licence.id}`}
                  target="_blank"
                  rel="noopener"
                  className="flex tap-target items-center gap-3 rounded-xl bg-surface-2 px-3 text-sm font-medium transition-colors hover:bg-surface-3"
                >
                  <Certificate className="size-4 shrink-0 text-link" aria-hidden />
                  <span className="flex-1">{t("wallet.certificate")}</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </a>
              </li>
              {licence.decisionId && (
                <li>
                  <a
                    href={`/api/files/letter/${licence.decisionId}`}
                    target="_blank"
                    rel="noopener"
                    className="flex tap-target items-center gap-3 rounded-xl bg-surface-2 px-3 text-sm font-medium transition-colors hover:bg-surface-3"
                  >
                    <Gavel className="size-4 shrink-0 text-link" aria-hidden />
                    <span className="flex-1">{t("wallet.decisionLetter")}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </a>
                </li>
              )}
              {licence.application && (
                <li>
                  <Link
                    href={`/applications/${licence.application.id}` as Route}
                    className="flex tap-target items-center gap-3 rounded-xl bg-surface-2 px-3 text-sm font-medium transition-colors hover:bg-surface-3"
                  >
                    <ScrollText className="size-4 shrink-0 text-link" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col py-2">
                      <span>{t("wallet.application")}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {licence.application.referenceNo}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              )}
            </ul>
            <Button asChild variant="link" className="self-start px-0">
              <Link href={`/check/${encodeURIComponent(licence.licenceNo)}` as Route}>
                {t("wallet.publicEntry")} <ArrowRight />
              </Link>
            </Button>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section
            aria-labelledby="details-title"
            className="flex flex-col gap-5 rounded-3xl border bg-card p-5 raised sm:p-6"
          >
            <h2 id="details-title" className="text-lg">
              {t("verification.detailsTitle")}
            </h2>
            <FactGrid facts={facts} />
          </section>

          {(rera || conditions.length > 0) && (
            <section
              aria-labelledby="conditions-title"
              className="flex flex-col gap-3 rounded-3xl border bg-card p-5 raised sm:p-6"
            >
              <div className="flex items-center gap-2">
                <ListChecks className="size-4 text-link" aria-hidden />
                <h2 id="conditions-title" className="text-lg">
                  {t("registerResults.fields.conditions")}
                </h2>
              </div>
              <ul className="flex flex-col gap-1.5">
                {rera && (
                  <li className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold">
                    {t("licence.referralOnly")}
                  </li>
                )}
                {conditions.map((c) => (
                  <li
                    key={c.key}
                    className="flex flex-col rounded-xl bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">{c.label}</span>
                    {c.detail && <span className="text-muted-foreground">{c.detail}</span>}
                    {c.endsOn && (
                      <span className="text-xs text-muted-foreground">
                        {t("wallet.conditionUntil", { date: formatDay(c.endsOn, locale) })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            aria-labelledby="obligations-title"
            className="flex flex-col gap-3 rounded-3xl border bg-card p-5 raised sm:p-6"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-link" aria-hidden />
              <h2 id="obligations-title" className="text-lg">
                {rera ? t("wallet.article10.title") : t("wallet.obligations.title")}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {rera ? t("wallet.article10.intro") : t("wallet.obligations.intro")}
            </p>
            <ul className="flex flex-col gap-2">
              {(rera ? ARTICLE_10 : OBLIGATIONS).map((key) => (
                <li key={key} className="flex gap-2.5 text-sm">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>
                    {rera
                      ? t(`wallet.article10.items.${key as (typeof ARTICLE_10)[number]}`)
                      : t(`wallet.obligations.items.${key as (typeof OBLIGATIONS)[number]}`)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {licence.events.length > 0 && (
            <section
              aria-labelledby="history-title"
              className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
            >
              <div className="flex items-center gap-2">
                <History className="size-4 text-link" aria-hidden />
                <h2 id="history-title" className="text-lg">
                  {t("verification.historyTitle")}
                </h2>
              </div>
              <LicenceHistory events={licence.events} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
