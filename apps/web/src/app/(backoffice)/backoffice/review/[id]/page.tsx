import {
  ArrowLeft,
  ClipboardCheck,
  FileStack,
  Handshake,
  History,
  ListChecks,
  MessageSquare,
  Play,
  ScanSearch,
  UserRound,
} from "@/components/icons";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  APPLICATION_STATUS_TONES,
  CONFIRMATION_STATUS_TONES,
  sectionsFor,
  type ApplicationStatus,
  type ConfirmationStatus,
  type DocumentType,
  type LicenseStatus,
  type ReviewDraft,
  type VerificationItem,
  VERIFICATION_ITEMS,
} from "@rebp/contracts";
import { ApplicationSummary } from "@/components/applications/application-summary";
import {
  ApplicationStatusBadge,
  LicenceStatusBadge,
} from "@/components/applications/status-badges";
import { StatusTimeline, type TimelineStep } from "@/components/data/status-timeline";
import { RuleList } from "@/components/eligibility/rule-list";
import { AssignDialog } from "@/components/review/assign-dialog";
import { DOCUMENT_STATUS_TONES, DocumentViewer } from "@/components/review/document-viewer";
import { ConfirmationOverride, ReviewActions } from "@/components/review/review-actions";
import { ReviewForm, type DraftFields, type EvidenceView } from "@/components/review/review-form";
import { SignedReview, toSignedReview } from "@/components/review/signed-review";
import { SlaBadge } from "@/components/review/sla-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatDay } from "@/lib/format";
import { userCan } from "@/server/access/permissions";
import { asData } from "@/server/applications/applications";
import { requireCapability } from "@/server/auth/guards";
import { conflictsFor, reviewers } from "@/server/backoffice/assignment";
import { applicantOverview } from "@/server/backoffice/queue";
import { computedReview, slaState } from "@/server/backoffice/review";
import { divisionNames, reviewConsole, userNames } from "@/server/backoffice/review-queries";
import { BreadcrumbTail } from "@/components/layout/breadcrumbs";

export async function generateMetadata({
  params,
}: PageProps<"/backoffice/review/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("review");
  return { title: t("metaTitle", { id: id.slice(0, 8) }) };
}

const WORKING: readonly ApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_CONFIRMATIONS",
];
const REVIEWING: readonly ApplicationStatus[] = ["UNDER_REVIEW", "FURTHER_ASSESSMENT"];

/**
 * Section L review console (WP-3.3/3.5, FR-L-001…011, FR-BO-005/006, BR-090/093): application
 * data beside the documents, auto-computed evidence, confirmations, the versioned review form,
 * information requests, the timeline and a 360° view of the applicant. Reading needs review.view;
 * every action re-checks review.perform and the assignment on the server.
 */
export default async function ReviewConsolePage({ params }: PageProps<"/backoffice/review/[id]">) {
  const { user } = await requireCapability("review.view");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const app = await reviewConsole(id);
  if (!app) notFound();

  const status = app.status as ApplicationStatus;
  const data = asData(app.data);
  const assignedToMe = app.assignedOfficerId === user.id;
  const [t, locale, canPerform, canOverride, computed, overview, officers, conflicts] =
    await Promise.all([
      getTranslations(),
      getLocale(),
      userCan(user, "review.perform"),
      userCan(user, "confirmation.override"),
      computedReview(app),
      applicantOverview(app.applicantId),
      reviewers(),
      assignedToMe ? conflictsFor(app.id, user.id) : Promise.resolve([] as string[]),
    ]);
  const addressCodes = (a?: {
    province?: string;
    district?: string;
    sector?: string;
    cell?: string;
    village?: string;
  }) => (a ? [a.province, a.district, a.sector, a.cell, a.village] : []);
  const [names, divisions] = await Promise.all([
    userNames([
      ...app.events.map((e) => e.actorId),
      ...app.infoRequests.map((r) => r.officerId),
      ...app.confirmations.map((c) => c.overriddenById),
    ]),
    divisionNames([
      ...addressCodes(data.b?.residentialAddress),
      ...addressCodes(data.b?.professionalAddress),
      ...(data.g?.territory ?? []),
      ...addressCodes(data.g?.registeredOffice),
      ...addressCodes(data.g?.principalPlace),
      ...(data.g?.branches ?? []).flatMap((b) => addressCodes(b.address)),
    ]),
  ]);

  const canWork = canPerform && assignedToMe && conflicts.length === 0;
  const editable = canWork && REVIEWING.includes(status);
  const latest = app.reviews[0];
  const signed = app.reviews.filter((r) => r.signedAt);
  const sla = slaState(app);
  const snapshot = app.snapshots[0];

  const evidence = Object.fromEntries(
    VERIFICATION_ITEMS.map((item) => [
      item,
      {
        suggested: computed.evidence[item].suggested,
        rules: computed.evidence[item].rules.map((r) => ({ id: r.id, outcome: r.outcome })),
        documents: computed.evidence[item].documents.map((d) => ({
          type: d.type,
          statuses: [...d.statuses],
        })),
      } satisfies EvidenceView,
    ]),
  ) as Record<VerificationItem, EvidenceView>;

  const initial: DraftFields = {
    checks: (latest?.checks ?? {}) as ReviewDraft["checks"],
    documentation:
      (latest?.documentation as DraftFields["documentation"]) ?? computed.documentation,
    documentationOverrideReason: latest?.documentationOverrideReason ?? "",
    eligibility: (latest?.eligibility as DraftFields["eligibility"]) ?? computed.eligibilityOutcome,
    eligibilityOverrideReason: latest?.eligibilityOverrideReason ?? "",
    internalComment: latest?.internalComment ?? "",
    applicantComment: latest?.applicantComment ?? "",
    recommendation: (latest?.recommendation as DraftFields["recommendation"]) ?? undefined,
    reasonCodes: (latest?.reasonCodes ?? []) as DraftFields["reasonCodes"],
    reasons: latest?.reasons ?? "",
    legalReference: latest?.legalReference ?? "",
  };

  const steps: TimelineStep[] = app.events.map((event, index) => {
    const last = index === app.events.length - 1;
    const reasonKey = event.reason
      ? `review.eventReasons.${event.reason.replace(/\./g, "_")}`
      : null;
    const actor = event.actorId ? names[event.actorId] : t("review.timeline.system");
    return {
      key: String(event.id),
      title: t(`status.application.${event.toStatus}`),
      meta: [
        formatDateTime(event.at, locale),
        actor,
        reasonKey && t.has(reasonKey) ? t(reasonKey) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      state: last ? "current" : "done",
      tone: last ? APPLICATION_STATUS_TONES[event.toStatus as ApplicationStatus] : undefined,
    };
  });

  const docLabel = (type: string) =>
    t.has(`review.docTypes.${type}`) ? t(`review.docTypes.${type}`) : type;

  return (
    <>
      <BreadcrumbTail
        label={app.referenceNo}
        parent={{ href: "/backoffice/queue", label: "queue" }}
      />
      <PageWidth wide />
      <PageHeader
        eyebrow={t("review.eyebrow")}
        title={<span className="font-mono">{app.referenceNo}</span>}
        description={`${app.applicant.fullName} · ${t(`categories.items.${app.category}.name`)} · ${t(`applicationTypes.${app.type}.name`)}`}
        actions={
          <Button asChild variant="ghost">
            <Link href="/backoffice/queue">
              <ArrowLeft /> {t("review.backToQueue")}
            </Link>
          </Button>
        }
      />

      <section
        aria-label={t("review.overview")}
        className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6 @3xl/main:flex-row @3xl/main:items-center @3xl/main:justify-between"
      >
        <div className="flex flex-wrap items-center gap-2">
          <ApplicationStatusBadge status={status} size="lg" />
          <SlaBadge state={sla} due={app.slaDueAt ? formatDay(app.slaDueAt, locale) : undefined} />
          <span className="inline-flex items-center gap-1.5 text-sm">
            <UserRound className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">{t("review.officer")}:</span>
            <span className="font-medium">
              {app.assignedOfficer
                ? assignedToMe
                  ? t("queue.you")
                  : app.assignedOfficer.fullName
                : t("queue.unassigned")}
            </span>
          </span>
          {app.submittedAt && (
            <span className="text-sm text-muted-foreground">
              {t("queue.submitted", { date: formatDay(app.submittedAt, locale) })}
            </span>
          )}
          {snapshot && (
            <span className="text-xs text-muted-foreground" title={snapshot.hash}>
              {t("review.snapshot", {
                version: snapshot.version,
                hash: snapshot.hash.slice(0, 12),
              })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canPerform && WORKING.includes(status) && (
            <AssignDialog
              applicationId={app.id}
              reference={app.referenceNo}
              currentOfficerId={app.assignedOfficerId}
              officers={officers}
              selfId={user.id}
            />
          )}
          <ReviewActions
            applicationId={app.id}
            selfId={user.id}
            canTake={canPerform && !app.assignedOfficerId && WORKING.includes(status)}
            canStart={canWork && status === "SUBMITTED"}
            canRequest={editable}
            canRecuse={canPerform && assignedToMe && WORKING.includes(status)}
            sections={sectionsFor(app.type, app.category)}
            documents={computed.checklist.map((row) => row.type as DocumentType)}
          />
        </div>
      </section>

      {conflicts.length > 0 && (
        <Alert variant="danger" title={t("review.alerts.conflictTitle")}>
          {conflicts.map((reason) => t(`queue.conflictReasons.${reason}`)).join(" · ")}
        </Alert>
      )}
      {!canPerform && <Alert variant="info">{t("review.alerts.readOnly")}</Alert>}
      {canPerform && app.assignedOfficer && !assignedToMe && (
        <Alert variant="info">
          {t("review.alerts.assignedElsewhere", { name: app.assignedOfficer.fullName })}
        </Alert>
      )}
      {status === "ACTION_REQUIRED" && (
        <Alert variant="warning" title={t("review.alerts.waitingTitle")}>
          {app.slaDueAt
            ? t("review.alerts.waiting", { date: formatDay(app.slaDueAt, locale) })
            : t("review.alerts.waitingNoDate")}
        </Alert>
      )}

      {/* Split view: data beside documents (FR-L-002/003). */}
      <div className="grid items-start gap-4 @3xl/main:grid-cols-2">
        <section
          aria-labelledby="data-title"
          className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6 @3xl/main:max-h-[calc(100dvh-7rem)] @3xl/main:overflow-y-auto"
        >
          <h2 id="data-title" className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="size-5 text-link" aria-hidden /> {t("review.data")}
          </h2>
          <ApplicationSummary
            type={app.type}
            category={app.category}
            data={data}
            locale={locale}
            divisions={divisions}
          />
        </section>
        <section
          aria-labelledby="docs-title"
          className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6 @3xl/main:sticky @3xl/main:top-20"
        >
          <h2 id="docs-title" className="flex items-center gap-2 text-lg">
            <FileStack className="size-5 text-link" aria-hidden />{" "}
            {t("review.documents", { count: app.documents.length })}
          </h2>
          <DocumentViewer
            locale={locale}
            canVerdict={canWork && WORKING.includes(status) && status !== "ACTION_REQUIRED"}
            documents={app.documents.map((d) => ({
              id: d.id,
              type: d.type,
              status: d.status,
              officerNote: d.officerNote,
              versions: d.versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
            }))}
          />
        </section>
      </div>

      {/* Auto-computed evidence (FR-L-004), checklist and confirmations (FR-F-007). */}
      <div className="grid items-start gap-4 @3xl/main:grid-cols-3">
        <section
          aria-labelledby="rules-title"
          className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="rules-title" className="flex items-center gap-2 text-lg">
              <ScanSearch className="size-5 text-link" aria-hidden /> {t("review.eligibility")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("review.computedOutcome", {
                outcome: t(`review.eligibilityOutcomes.${computed.eligibilityOutcome}`),
              })}
            </p>
          </div>
          {computed.eligibility.rules.length > 0 ? (
            <RuleList rules={computed.eligibility.rules} locale={locale} showIds />
          ) : (
            <p className="text-sm text-muted-foreground">{t("review.noRules")}</p>
          )}
        </section>

        <section
          aria-labelledby="checklist-title"
          className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="checklist-title" className="flex items-center gap-2 text-lg">
              <ListChecks className="size-5 text-link" aria-hidden /> {t("review.checklist")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("review.computedOutcome", {
                outcome: t(`review.documentationOutcomes.${computed.documentation}`),
              })}
            </p>
          </div>
          <ul className="flex flex-col divide-y">
            {computed.checklist.map((row) => {
              const docStatus = row.statuses[0];
              return (
                <li
                  key={row.type}
                  className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1 text-sm font-medium">{docLabel(row.type)}</span>
                  <Badge variant={row.requirement === "M" ? "outline" : "neutral"}>
                    {row.requirement === "M" ? t("review.mandatory") : t("review.conditional")}
                  </Badge>
                  {docStatus ? (
                    <StatusBadge
                      tone={DOCUMENT_STATUS_TONES[docStatus] ?? "neutral"}
                      label={t(`review.docStatus.${docStatus}`)}
                    />
                  ) : (
                    <StatusBadge
                      tone={row.required ? "warning" : "neutral"}
                      label={t("review.docStatus.MISSING")}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-labelledby="confirm-title"
          className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
        >
          <h2 id="confirm-title" className="flex items-center gap-2 text-lg">
            <Handshake className="size-5 text-link" aria-hidden /> {t("review.confirmations")}
          </h2>
          {app.confirmations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("review.noConfirmations")}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {app.confirmations.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold">{c.addressee.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`review.confirmationKinds.${c.kind}`)}
                      </span>
                    </span>
                    <StatusBadge
                      tone={CONFIRMATION_STATUS_TONES[c.status as ConfirmationStatus]}
                      label={t(`status.confirmation.${c.status}`)}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {c.respondedAt
                      ? t("review.respondedOn", { date: formatDay(c.respondedAt, locale) })
                      : t("review.dueOn", { date: formatDay(c.dueAt, locale) })}
                  </span>
                  {c.reason && <p className="text-sm">{c.reason}</p>}
                  {c.overriddenById && (
                    <p className="text-xs text-muted-foreground">
                      {t("review.overriddenBy", {
                        name: names[c.overriddenById] ?? "—",
                        reason: c.overrideReason ?? "",
                      })}
                    </p>
                  )}
                  {canOverride && c.status === "PENDING" && (
                    <div>
                      <ConfirmationOverride id={c.id} name={c.addressee.fullName} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Section L (FR-L-003…010). */}
      {editable ? (
        <ReviewForm
          applicationId={app.id}
          initial={initial}
          evidence={evidence}
          computed={{
            documentation: computed.documentation,
            eligibility: computed.eligibilityOutcome,
          }}
          savedAt={latest && !latest.signedAt ? latest.updatedAt.toISOString() : null}
        />
      ) : signed.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl border bg-card p-8 text-center raised">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
            <Play className="size-5" aria-hidden />
          </span>
          <h2 className="text-lg">{t("review.form.title")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {status === "SUBMITTED" && canWork ? t("review.startFirst") : t("review.notStarted")}
          </p>
        </section>
      ) : null}

      {signed.length > 0 && (
        <section
          aria-labelledby="signed-title"
          className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
        >
          <h2 id="signed-title" className="text-lg">
            {t("review.signedReviews", { count: signed.length })}
          </h2>
          <SignedReview review={toSignedReview(signed[0]!)} locale={locale} />
          {signed.slice(1).map((r) => (
            <details key={r.id} className="group rounded-2xl bg-surface-2 p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {t("review.previousVersion", {
                  version: r.version,
                  date: formatDateTime(r.signedAt!, locale),
                })}
              </summary>
              <SignedReview review={toSignedReview(r)} locale={locale} className="mt-4" />
            </details>
          ))}
        </section>
      )}

      <div className="grid items-start gap-4 @3xl/main:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <section
            aria-labelledby="timeline-title"
            className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
          >
            <h2 id="timeline-title" className="flex items-center gap-2 text-lg">
              <History className="size-5 text-link" aria-hidden /> {t("review.timeline.title")}
            </h2>
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("review.timeline.empty")}</p>
            ) : (
              <StatusTimeline steps={steps} />
            )}
          </section>

          <section
            aria-labelledby="rounds-title"
            className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
          >
            <h2 id="rounds-title" className="flex items-center gap-2 text-lg">
              <MessageSquare className="size-5 text-link" aria-hidden /> {t("review.rounds.title")}
            </h2>
            {app.infoRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("review.rounds.empty")}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {app.infoRequests.map((r, index) => (
                  <li key={r.id} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {t("review.rounds.round", { n: app.infoRequests.length - index })} ·{" "}
                        {t.has(`review.request.templates.${r.template}.label`)
                          ? t(`review.request.templates.${r.template}.label`)
                          : r.template}
                      </span>
                      <Badge
                        variant={
                          r.status === "OPEN"
                            ? "warning"
                            : r.status === "RESPONDED"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {t(`review.rounds.status.${r.status}`)}
                      </Badge>
                    </div>
                    <p className="text-sm whitespace-pre-line">{r.message}</p>
                    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
                      <dt className="text-muted-foreground">{t("review.rounds.sent")}</dt>
                      <dd>
                        {formatDateTime(r.createdAt, locale)} · {names[r.officerId] ?? "—"}
                      </dd>
                      <dt className="text-muted-foreground">{t("review.rounds.due")}</dt>
                      <dd>{formatDay(r.dueAt, locale)}</dd>
                      {r.respondedAt && (
                        <>
                          <dt className="text-muted-foreground">{t("review.rounds.responded")}</dt>
                          <dd>{formatDateTime(r.respondedAt, locale)}</dd>
                        </>
                      )}
                      {r.sections.length > 0 && (
                        <>
                          <dt className="text-muted-foreground">{t("review.rounds.sections")}</dt>
                          <dd>{r.sections.map((s) => s.toUpperCase()).join(", ")}</dd>
                        </>
                      )}
                      {(r.documents.length > 0 || r.extraDocument) && (
                        <>
                          <dt className="text-muted-foreground">{t("review.rounds.documents")}</dt>
                          <dd>
                            {[...r.documents.map(docLabel), r.extraDocument]
                              .filter(Boolean)
                              .join(", ")}
                          </dd>
                        </>
                      )}
                    </dl>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* FR-BO-006: 360° view of the applicant. */}
        <section
          aria-labelledby="applicant-title"
          className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
        >
          <h2 id="applicant-title" className="flex items-center gap-2 text-lg">
            <UserRound className="size-5 text-link" aria-hidden /> {t("review.applicant.title")}
          </h2>
          {overview.user && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t("review.applicant.name")}</dt>
              <dd className="font-medium">{overview.user.fullName}</dd>
              <dt className="text-muted-foreground">{t("review.applicant.email")}</dt>
              <dd className="break-all">{overview.user.email}</dd>
              {overview.user.phone && (
                <>
                  <dt className="text-muted-foreground">{t("review.applicant.phone")}</dt>
                  <dd>{overview.user.phone}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{t("review.applicant.account")}</dt>
              <dd>{t(`review.applicant.accountTypes.${overview.user.accountType}`)}</dd>
              <dt className="text-muted-foreground">{t("review.applicant.since")}</dt>
              <dd>{formatDay(overview.user.createdAt, locale)}</dd>
              <dt className="text-muted-foreground">{t("review.applicant.twoStep")}</dt>
              <dd>{overview.user.mfaMethods.length > 0 ? t("summary.yes") : t("summary.no")}</dd>
            </dl>
          )}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {t("review.applicant.licences", { count: overview.licences.length })}
            </h3>
            {overview.licences.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("review.applicant.noLicences")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {overview.licences.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-mono text-sm font-semibold">{l.licenceNo}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`categories.items.${l.category}.name`)} ·{" "}
                        {t("review.applicant.expires", { date: formatDay(l.expiresAt, locale) })}
                      </span>
                    </span>
                    <LicenceStatusBadge status={l.status as LicenseStatus} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {t("review.applicant.applications", { count: overview.applications.length })}
            </h3>
            <ul className="flex flex-col gap-2">
              {overview.applications.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/backoffice/review/${a.id}` as Route}
                    aria-current={a.id === app.id ? "page" : undefined}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 transition-colors hover:bg-surface-3 aria-[current=page]:ring-2 aria-[current=page]:ring-primary/40"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-mono text-sm font-semibold">
                        {a.referenceNo}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(`categories.items.${a.category}.name`)} ·{" "}
                        {formatDay(a.createdAt, locale)}
                      </span>
                    </span>
                    <StatusBadge
                      tone={APPLICATION_STATUS_TONES[a.status as ApplicationStatus]}
                      label={t(`status.application.${a.status}`)}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
