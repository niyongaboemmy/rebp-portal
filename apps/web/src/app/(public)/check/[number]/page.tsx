import {
  ArrowRight,
  BookUser,
  Building2,
  Certificate,
  History,
  RefreshCw,
  SearchX,
} from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { LICENSE_STATUS_TONES } from "@rebp/contracts";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { TONE_ICONS, TONE_SOFT_BG, TONE_TEXT } from "@/components/data/tones";
import { FactGrid, type Fact } from "@/components/licence/fact-grid";
import { LicenceHistory } from "@/components/licence/licence-history";
import { VerifySearch } from "@/components/register/verify-search";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import { parseCondition } from "@/lib/licence-display";
import { cn } from "@/lib/utils";
import { resolveVerification } from "@/server/licensing/public-queries";
import { NO_INDEX, publicPageMetadata } from "@/server/seo";

/** Malformed escapes (e.g. a stray "%") are treated as the raw text, never a server error. */
const valueOf = (number: string) => {
  try {
    return decodeURIComponent(number).slice(0, 40);
  } catch {
    return number.slice(0, 40);
  }
};

export async function generateMetadata({
  params,
}: PageProps<"/check/[number]">): Promise<Metadata> {
  const { number } = await params;
  const value = valueOf(number);
  const t = await getTranslations();
  const result = await resolveVerification(value);
  // FR-REG-008: issued licences get indexable pages (canonical = licence number, never the QR
  // token); unknown numbers and replaced certificates are never indexed.
  if (result?.kind === "entry") {
    const { entry } = result;
    return publicPageMetadata({
      path: `/check/${encodeURIComponent(entry.licenceNo)}`,
      title: t("verification.metaTitle", { name: entry.displayName, number: entry.licenceNo }),
      description: t("verification.metaDescription", {
        name: entry.displayName,
        category: t(`categories.items.${entry.category}.name`),
        status: t(`status.licence.${entry.status}`),
      }),
    });
  }
  return { title: t("check.resultTitle", { number: value }), robots: NO_INDEX };
}

/**
 * FR-REG-004: the QR target. A full-width status hero readable in under two seconds, in the
 * tone of the status, with the time of the check, the certificate seal (FR-N-002 tamper
 * evidence) and the public status history. A replaced certificate points to the current one
 * (FR-N-012). Unknown numbers state plainly that no licence was found.
 */
export default async function CheckPage({ params }: PageProps<"/check/[number]">) {
  const { number } = await params;
  const value = valueOf(number);
  const [t, format, locale, result] = await Promise.all([
    getTranslations(),
    getFormatter(),
    getLocale(),
    resolveVerification(value),
  ]);
  const checkedAt = format.dateTime(new Date(), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Kigali",
  });

  if (result?.kind === "replaced") {
    return (
      <div className="flex flex-1 flex-col">
        <section
          className="relative isolate overflow-hidden bg-warning-soft text-warning"
          aria-live="polite"
        >
          <div aria-hidden className="absolute inset-0 -z-10 bg-imigongo opacity-[0.06]" />
          <div className="container-page flex flex-col items-center gap-3 py-12 text-center sm:py-16">
            <span className="inline-flex size-20 animate-pop items-center justify-center rounded-[1.6rem] bg-card shadow-[0_14px_30px_-14px_oklch(0.5_0.12_75/0.45)] dark:bg-white/[0.06]">
              <RefreshCw className="size-10" aria-hidden />
            </span>
            <h1 className="text-[clamp(1.75rem,1.4rem+2vw,3rem)] leading-tight font-bold tracking-[-0.02em]">
              {t("verification.replacedTitle")}
            </h1>
            <p className="max-w-md text-sm text-foreground">
              {t("verification.replacedBody", { number: result.current })}
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              {t("check.checkedAt", { time: checkedAt })}
            </p>
          </div>
        </section>
        <div className="container-page flex max-w-xl animate-rise flex-col items-center gap-4 py-12 sm:py-16">
          <Button asChild size="lg">
            <Link href={`/check/${encodeURIComponent(result.current)}` as Route}>
              {t("verification.seeCurrent", { number: result.current })} <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-1 flex-col">
        <section
          className="relative isolate overflow-hidden bg-danger-soft text-destructive"
          aria-live="polite"
        >
          <div aria-hidden className="absolute inset-0 -z-10 bg-imigongo opacity-[0.06]" />
          <div className="container-page flex flex-col items-center gap-3 py-12 text-center sm:py-16">
            <span className="inline-flex size-20 animate-pop items-center justify-center rounded-[1.6rem] bg-card shadow-[0_14px_30px_-14px_oklch(0.4_0.15_25/0.45)] dark:bg-white/[0.06]">
              <SearchX className="size-10" aria-hidden />
            </span>
            <h1 className="text-[clamp(1.75rem,1.4rem+2vw,3rem)] leading-tight font-bold tracking-[-0.02em]">
              {t("check.notFound")}
            </h1>
            <p className="font-mono text-lg font-semibold num text-foreground">{value}</p>
            <p className="text-xs font-medium text-muted-foreground">
              {t("check.checkedAt", { time: checkedAt })}
            </p>
          </div>
        </section>
        <div className="container-page flex max-w-xl animate-rise flex-col gap-4 py-12 sm:py-16">
          <p className="text-center text-sm text-muted-foreground">{t("check.notFoundBody")}</p>
          <VerifySearch />
        </div>
      </div>
    );
  }

  const { entry, seal, certificateVersion, history, names, replacedBy } = result;
  const tone = LICENSE_STATUS_TONES[entry.status];
  const ToneIcon = TONE_ICONS[tone];
  const firm = [entry.firmName, entry.branchName].filter(Boolean).join(" · ");
  const scope = entry.scope.map((c) => names.get(c) ?? c).join(", ");
  const conditions = entry.conditions
    .map(parseCondition)
    .filter((c) => !(entry.category === "RERA" && c.code === "REFERRAL_ONLY"))
    .map((c) =>
      c.code === "CUSTOM"
        ? (c.text ?? "")
        : `${t(`conditions.${c.code}`)}${c.text ? ` — ${c.text}` : ""}`,
    );

  const facts: Fact[] = [
    {
      key: "licenceNo",
      label: t("registerResults.fields.licenceNo"),
      value: entry.licenceNo,
      mono: true,
    },
    {
      key: "registrationNo",
      label: t("registerResults.fields.registrationNo"),
      value: entry.registrationNo,
      mono: true,
    },
    {
      key: "category",
      label: t("verification.category"),
      value: t(`categories.items.${entry.category}.name`),
    },
    {
      key: "validity",
      label: t("registerResults.fields.validity"),
      value: t("registerResults.validRange", {
        from: formatDay(entry.issuedAt, locale),
        to: formatDay(entry.expiresAt, locale),
      }),
    },
    ...(firm ? [{ key: "firm", label: t("registerResults.fields.firm"), value: firm }] : []),
    ...(entry.principalName
      ? [
          {
            key: "principal",
            label: t("registerResults.fields.principal"),
            value: entry.principalName,
          },
        ]
      : []),
    ...(entry.district
      ? [
          {
            key: "district",
            label: t("registerResults.fields.district"),
            value: names.get(entry.district) ?? entry.district,
          },
        ]
      : []),
    {
      key: "scope",
      label: t("registerResults.fields.scope"),
      value: scope || t("licence.nationwide"),
      wide: true,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <section
        className={cn("relative isolate overflow-hidden", TONE_SOFT_BG[tone], TONE_TEXT[tone])}
        aria-live="polite"
      >
        <div aria-hidden className="absolute inset-0 -z-10 bg-imigongo opacity-[0.06]" />
        <div className="container-page flex flex-col items-center gap-3 py-12 text-center sm:py-16">
          <span className="inline-flex size-20 animate-pop items-center justify-center rounded-[1.6rem] bg-card shadow-[0_14px_30px_-14px_oklch(0.3_0.05_260/0.4)] dark:bg-white/[0.06]">
            <ToneIcon className="size-10" aria-hidden />
          </span>
          <p className="text-sm font-bold tracking-widest uppercase">
            {t(`verification.verdict.${entry.status}`)}
          </p>
          <h1 className="text-[clamp(1.75rem,1.4rem+2vw,3rem)] leading-tight font-bold tracking-[-0.02em] text-foreground">
            {entry.displayName}
          </h1>
          <p className="text-base font-semibold text-foreground">
            {t(`categories.items.${entry.category}.name`)}
          </p>
          <p className="font-mono text-lg font-semibold num text-foreground">{entry.licenceNo}</p>
          {entry.category === "RERA" && (
            <span className="rounded-full bg-card px-3 py-1 text-xs font-bold text-warning dark:bg-white/[0.06]">
              {t("licence.referralOnly")}
            </span>
          )}
          <p className="max-w-md text-sm text-foreground">
            {t(`verification.verdictBody.${entry.status}`)}
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            {t("check.checkedAt", { time: checkedAt })}
          </p>
        </div>
      </section>

      <div className="container-page flex max-w-3xl animate-rise flex-col gap-4 py-10 sm:py-14">
        {replacedBy && (
          <div className="flex flex-col gap-3 rounded-3xl bg-warning-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="text-sm font-medium">
              {t("verification.supersededBy", { number: replacedBy })}
            </p>
            <Button asChild variant="outline" className="shrink-0">
              <Link href={`/check/${encodeURIComponent(replacedBy)}` as Route}>
                {t("verification.seeCurrent", { number: replacedBy })} <ArrowRight />
              </Link>
            </Button>
          </div>
        )}

        <section
          aria-labelledby="details-title"
          className="flex flex-col gap-5 rounded-3xl border bg-card p-5 raised sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {entry.kind === "FIRM" ? (
                <Building2 className="size-4 text-link" aria-hidden />
              ) : (
                <BookUser className="size-4 text-link" aria-hidden />
              )}
              <h2 id="details-title" className="text-lg">
                {t("verification.detailsTitle")}
              </h2>
            </div>
            <LicenceStatusBadge status={entry.status} />
          </div>
          <FactGrid facts={facts} />
          {(entry.category === "RERA" || conditions.length > 0) && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t("registerResults.fields.conditions")}</h3>
              <ul className="flex flex-col gap-1.5">
                {entry.category === "RERA" && (
                  <li className="rounded-xl bg-warning-soft px-3 py-2 text-sm">
                    <span className="font-semibold">{t("licence.referralOnly")}</span>
                    <span className="block text-muted-foreground">
                      {t("verification.referralOnlyBody")}
                    </span>
                  </li>
                )}
                {conditions.map((c) => (
                  <li key={c} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {seal && (
          <section
            aria-labelledby="seal-title"
            className="flex items-start gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
          >
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-link">
              <Certificate className="size-5" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="seal-title" className="text-base">
                {t("verification.sealTitle")}
              </h2>
              <p className="font-mono text-base font-semibold num break-all sm:text-lg">{seal}</p>
              <p className="text-sm text-muted-foreground">
                {t("verification.sealBody", { version: certificateVersion })}
              </p>
            </div>
          </section>
        )}

        {history.length > 0 && (
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
            <LicenceHistory events={history} />
          </section>
        )}

        <div className="flex flex-col gap-3 pt-4">
          <p className="text-center text-sm text-muted-foreground">
            {t("verification.checkAnother")}
          </p>
          <VerifySearch />
        </div>
      </div>
    </div>
  );
}
