import {
  ArrowLeft,
  Award,
  ChevronDown,
  ClipboardCheck,
  FileDown,
  Gavel,
  ScanSearch,
  ScrollText,
  ShieldAlert,
} from "@/components/icons";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import type {
  ApplicationStatus,
  DecisionCondition,
  LicenseStatus,
  StatusTone,
} from "@rebp/contracts";
import { ApplicationSummary } from "@/components/applications/application-summary";
import {
  ApplicationStatusBadge,
  LicenceStatusBadge,
} from "@/components/applications/status-badges";
import { RuleList } from "@/components/eligibility/rule-list";
import { DecisionForm } from "@/components/review/decision-form";
import { SignedReview, toSignedReview } from "@/components/review/signed-review";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatDay } from "@/lib/format";
import { asData } from "@/server/applications/applications";
import { requireCapability } from "@/server/auth/guards";
import { assertCanDecide } from "@/server/backoffice/decision";
import { computedReview } from "@/server/backoffice/review";
import {
  decisionConsole,
  districts as listDistricts,
  divisionNames,
} from "@/server/backoffice/review-queries";
import { isAppError } from "@/server/errors";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("decide"))("title") };
}

const DECISION_TONES: Record<string, StatusTone> = {
  APPROVED: "good",
  APPROVED_WITH_CONDITIONS: "good",
  DEFERRED: "warning",
  REJECTED: "critical",
};

/**
 * Section M decision screen (WP-3.6, FR-M-001…017, BR-091/092/093): the application and signed
 * review side by side with the decision form; once decided, the immutable decision record with
 * the licence number, certificate and decision letter.
 */
export default async function DecisionPage({
  params,
  searchParams,
}: PageProps<"/backoffice/decisions/[id]">) {
  const { user } = await requireCapability("decision.make");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const app = await decisionConsole(id);
  if (!app) notFound();
  const recorded = (await searchParams).recorded === "1";

  const data = asData(app.data);
  const status = app.status as ApplicationStatus;
  const review = app.reviews[0];
  const decision = app.decisions[0];
  const pending = status === "PENDING_DECISION";

  // BR-091 / BR-093: show why this approver may not decide, and disable the form.
  let block: { key: string; reasons: string[] } | null = null;
  if (pending) {
    try {
      await assertCanDecide(app.id, user);
    } catch (error) {
      if (!isAppError(error)) throw error;
      block = {
        key: error.message,
        reasons: String(error.meta?.reasons ?? "")
          .split(",")
          .filter(Boolean),
      };
    }
  }

  const [t, locale, computed, districts] = await Promise.all([
    getTranslations(),
    getLocale(),
    computedReview(app),
    pending ? listDistricts() : Promise.resolve([]),
  ]);
  const territory = data.g?.territory ?? [];
  const names = await divisionNames([...territory, ...(decision?.geoScope ?? [])]);
  const districtCodes = new Set(districts.map((d) => d.code));
  const defaultScope = territory.filter((code) => districtCodes.has(code));

  return (
    <>
      <PageHeader
        eyebrow={t("decide.eyebrow")}
        title={<span className="font-mono">{app.referenceNo}</span>}
        description={`${app.applicant.fullName} · ${t(`categories.items.${app.category}.name`)} · ${t(`applicationTypes.${app.type}.name`)}`}
        actions={
          <Button asChild variant="ghost">
            <Link href="/backoffice/decisions">
              <ArrowLeft /> {t("decide.back")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ApplicationStatusBadge status={status} size="lg" />
        <Button asChild variant="link" size="sm">
          <Link href={`/backoffice/review/${app.id}` as Route}>{t("decide.openReview")}</Link>
        </Button>
      </div>

      {recorded && decision && (
        <Alert variant="success" title={t("decide.recordedTitle")}>
          {t("decide.recordedBody", { letter: decision.letterNo })}
        </Alert>
      )}

      {block && (
        <Alert variant="danger" title={t("decide.blockedTitle")} data-testid="br091-banner">
          {t.has(block.key) ? t(block.key) : t("errors.forbidden")}
          {block.reasons.length > 0 && (
            <> {block.reasons.map((r) => t(`queue.conflictReasons.${r}`)).join(" · ")}</>
          )}
        </Alert>
      )}

      {!pending && !decision && (
        <Alert variant="info" title={t("decide.notPendingTitle")}>
          {t("decide.notPending", { status: t(`status.application.${status}`) })}
        </Alert>
      )}

      <div className="grid items-start gap-4 @3xl/main:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* Signed review (FR-M-001) */}
          <section
            aria-labelledby="review-title"
            className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
          >
            <h2 id="review-title" className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="size-5 text-link" aria-hidden /> {t("decide.review")}
            </h2>
            {review ? (
              <SignedReview review={toSignedReview(review)} locale={locale} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("decide.noReview")}</p>
            )}
          </section>

          <section
            aria-labelledby="elig-title"
            className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
          >
            <div className="flex flex-col gap-1">
              <h2 id="elig-title" className="flex items-center gap-2 text-lg">
                <ScanSearch className="size-5 text-link" aria-hidden /> {t("review.eligibility")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("review.computedOutcome", {
                  outcome: t(`review.eligibilityOutcomes.${computed.eligibilityOutcome}`),
                })}
              </p>
            </div>
            <RuleList
              rules={computed.eligibility.rules}
              locale={locale}
              showIds
              showPasses={false}
            />
            {computed.eligibility.rules.every((r) => r.outcome === "PASS") && (
              <p className="text-sm text-muted-foreground">{t("decide.allRulesPass")}</p>
            )}
          </section>

          <details className="group rounded-3xl border bg-card raised">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-lg font-semibold">
                <ScrollText className="size-5 text-link" aria-hidden /> {t("decide.application")}
              </span>
              <ChevronDown
                className="size-5 shrink-0 text-muted-foreground transition-transform duration-(--dur-2) group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <ApplicationSummary
                type={app.type}
                category={app.category}
                data={data}
                locale={locale}
                divisions={names}
              />
            </div>
          </details>
        </div>

        {/* Section M form or the immutable record (FR-M-014) */}
        <section
          aria-labelledby="decision-title"
          className="flex flex-col gap-5 rounded-3xl border bg-card p-5 raised sm:p-6 @3xl/main:sticky @3xl/main:top-20"
        >
          <h2 id="decision-title" className="flex items-center gap-2 text-lg">
            <Gavel className="size-5 text-link" aria-hidden /> {t("decide.title")}
          </h2>
          {decision ? (
            <div className="flex flex-col gap-5" data-testid="decision-record">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  tone={DECISION_TONES[decision.decision] ?? "neutral"}
                  label={t(`decision.types.${decision.decision}`)}
                  size="lg"
                />
                <Badge variant="neutral">{t("decide.immutable")}</Badge>
              </div>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(8rem,12rem)_1fr]">
                <dt className="text-muted-foreground">{t("decide.record.approver")}</dt>
                <dd className="font-medium">{decision.approver.fullName}</dd>
                <dt className="text-muted-foreground">{t("decide.record.signedAt")}</dt>
                <dd>{formatDateTime(decision.signedAt, locale)}</dd>
                <dt className="text-muted-foreground">{t("decide.record.letterNo")}</dt>
                <dd className="font-mono">{decision.letterNo}</dd>
                {decision.approvedCategory && (
                  <>
                    <dt className="text-muted-foreground">{t("decide.record.category")}</dt>
                    <dd>{t(`categories.items.${decision.approvedCategory}.name`)}</dd>
                  </>
                )}
                {(decision.decision === "APPROVED" ||
                  decision.decision === "APPROVED_WITH_CONDITIONS") && (
                  <>
                    <dt className="text-muted-foreground">{t("decide.record.scope")}</dt>
                    <dd>
                      {decision.geoScope.length === 0
                        ? t("decide.form.nationwide")
                        : decision.geoScope.map((c) => names[c] ?? c).join(", ")}
                    </dd>
                  </>
                )}
                {(decision.conditions as unknown as DecisionCondition[]).length > 0 && (
                  <>
                    <dt className="text-muted-foreground">{t("decide.record.conditions")}</dt>
                    <dd>
                      <ul className="flex flex-col gap-1.5">
                        {(decision.conditions as unknown as DecisionCondition[]).map((c, i) => (
                          <li key={i} className="flex flex-col">
                            <span className="font-medium">
                              {c.code === "CUSTOM" && c.text ? c.text : t(`conditions.${c.code}`)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {[
                                c.code !== "CUSTOM" ? c.text : null,
                                c.endsOn
                                  ? t("decide.record.until", { date: formatDay(c.endsOn, locale) })
                                  : null,
                                c.publicOnRegister === false
                                  ? t("decide.record.private")
                                  : t("decide.record.public"),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {decision.reasonCodes.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">{t("review.form.reasonCodes")}</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {decision.reasonCodes.map((code) => (
                        <Badge key={code} variant="danger">
                          {t(`review.reasonCodes.${code}`)}
                        </Badge>
                      ))}
                    </dd>
                  </>
                )}
                {decision.reasons && (
                  <>
                    <dt className="text-muted-foreground">{t("decide.record.reasons")}</dt>
                    <dd className="whitespace-pre-line">{decision.reasons}</dd>
                  </>
                )}
              </dl>

              {app.licences.length > 0 ? (
                app.licences.map((licence) => (
                  <div
                    key={licence.id}
                    className="flex flex-col gap-3 rounded-2xl bg-success-soft p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Award className="size-5 text-success" aria-hidden />
                        <span className="flex flex-col">
                          <span className="text-xs text-muted-foreground">
                            {t("decide.record.licence")}
                          </span>
                          <span
                            className="font-mono text-lg font-bold"
                            data-testid="issued-licence"
                          >
                            {licence.licenceNo}
                          </span>
                        </span>
                      </span>
                      <LicenceStatusBadge status={licence.status as LicenseStatus} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t("decide.record.validity", {
                        from: formatDay(licence.issuedAt, locale),
                        to: formatDay(licence.expiresAt, locale),
                      })}
                    </span>
                    <Button asChild variant="outline" size="sm" className="self-start">
                      <a
                        href={`/api/files/certificate/${licence.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileDown /> {t("decide.record.certificate")}
                      </a>
                    </Button>
                  </div>
                ))
              ) : decision.decision === "APPROVED" ||
                decision.decision === "APPROVED_WITH_CONDITIONS" ? (
                <Alert variant="warning">{t("decide.record.issuancePending")}</Alert>
              ) : null}

              <Button asChild variant="outline" className="self-start">
                <a href={`/api/files/letter/${decision.id}`} target="_blank" rel="noreferrer">
                  <FileDown /> {t("decide.record.letter")}
                </a>
              </Button>
            </div>
          ) : pending ? (
            <>
              {review?.recommendation && (
                <p className="text-sm text-muted-foreground">
                  {t("decide.recommendationLine", {
                    recommendation: t(`review.recommendations.${review.recommendation}.label`),
                    name: review.officer.fullName,
                  })}
                </p>
              )}
              <DecisionForm
                applicationId={app.id}
                districts={districts.map((d) => ({ code: d.code, name: d.name }))}
                defaultScope={defaultScope}
                blocked={Boolean(block)}
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <ShieldAlert className="size-8 text-muted-foreground" aria-hidden />
              <p className="max-w-sm text-sm text-muted-foreground">{t("decide.noDecisionYet")}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
