import {
  ClipboardCheck,
  FileStack,
  Handshake,
  History,
  ListChecks,
  MessageSquare,
  Play,
  ScanSearch,
  Signature,
  UserRound,
} from "@/components/icons";
import { applicantPhotoUrls } from "@/server/profile/documents";
import { ApplicantPhoto } from "@/components/applications/applicant-photo";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  APPLICATION_STATUS_TONES,
  sectionsFor,
  type ApplicationStatus,
  type ConfirmationStatus,
  type DocumentType,
  type LicenseStatus,
  type PaymentStatus,
  type ReviewDraft,
  type VerificationItem,
  VERIFICATION_ITEMS,
} from "@rebp/contracts";
import { ApplicationHeader } from "@/components/applications/application-header";
import { ApplicationSummary } from "@/components/applications/application-summary";
import { LifecycleTrack } from "@/components/applications/lifecycle-track";
import {
  ApplicationStatusBadge,
  LicenceStatusBadge,
  PaymentStatusBadge,
} from "@/components/applications/status-badges";
import { ProgressRing } from "@/components/data/progress-ring";
import { StatusTimeline, type TimelineStep } from "@/components/data/status-timeline";
import { BreadcrumbTail } from "@/components/layout/breadcrumbs";
import { PageWidth } from "@/components/layout/page-width";
import { LookAtPointer } from "@/components/motion/look-at-pointer";
import { ProfileBuddy, type BuddyMood } from "@/components/profile/profile-buddy";
import { AssignDialog } from "@/components/review/assign-dialog";
import {
  ConsoleTabs,
  type ConsoleGuide,
  type ConsoleTabKey,
} from "@/components/review/console-tabs";
import { DocumentViewer } from "@/components/review/document-viewer";
import { NextActionDock, type NextAction } from "@/components/review/next-action-dock";
import { ValidationCelebration } from "@/components/review/validation-celebration";
import { blobReadable } from "@/server/storage/blob-store";
import {
  AttentionPill,
  LIST_GROUP,
  LIST_ROW,
  Mark,
  type MarkState,
} from "@/components/review/marks";
import { ConfirmationOverride, ReviewActions } from "@/components/review/review-actions";
import { ReviewForm, type DraftFields, type EvidenceView } from "@/components/review/review-form";
import { RuleRows } from "@/components/review/rule-rows";
import { SignedReview, toSignedReview } from "@/components/review/signed-review";
import { SlaBadge } from "@/components/review/sla-badge";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { PANEL } from "@/components/ui/surface";
import { formatDateTime, formatDay, formatMoney } from "@/lib/format";
import { lifecycleOf } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";
import { userCan } from "@/server/access/permissions";
import { asData } from "@/server/applications/applications";
import { requireCapability } from "@/server/auth/guards";
import { conflictsFor, reviewers } from "@/server/backoffice/assignment";
import { applicantOverview } from "@/server/backoffice/queue";
import { computedReview, slaState } from "@/server/backoffice/review";
import {
  divisionNames,
  nextFileFor,
  reviewConsole,
  userNames,
} from "@/server/backoffice/review-queries";

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
const ASSIGNABLE: readonly ApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
];
const DECIDED: readonly ApplicationStatus[] = [
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
  "LICENSE_ISSUED",
  "REJECTED",
  "DEFERRED",
];

const DOC_FAILED = ["REJECTED", "INFECTED", "REJECTED_FILE"];
const CONFIRMATION_MARKS: Record<ConfirmationStatus, MarkState> = {
  PENDING: "todo",
  CONFIRMED: "done",
  DECLINED: "failed",
  EXPIRED: "none",
  CANCELLED: "none",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** Section headings inside the console's panels: a soft icon tile and the title. */
function PanelTitle({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: typeof ClipboardCheck;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-lg">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link">
        <Icon className="size-[1.1rem]" aria-hidden />
      </span>
      {children}
    </h2>
  );
}

/**
 * Section L review console (WP-3.3/3.5, FR-L-001…011, FR-BO-005/006, BR-090/093): where the file
 * stands on the six-step journey, application data beside the documents (each with its verdict),
 * auto-computed evidence, confirmations, the versioned review form with its live progress and
 * sticky footer, information requests, the timeline and a 360° view of the applicant. Reading
 * needs review.view; every action re-checks review.perform and the assignment on the server.
 */
export default async function ReviewConsolePage({
  params,
  searchParams,
}: PageProps<"/backoffice/review/[id]">) {
  const { user } = await requireCapability("review.view");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const app = await reviewConsole(id);
  if (!app) notFound();

  const status = app.status as ApplicationStatus;
  const data = asData(app.data);
  const assignedToMe = app.assignedOfficerId === user.id;
  const [t, locale, canPerform, canLead, canOverride, computed, overview, officers, conflicts] =
    await Promise.all([
      getTranslations(),
      getLocale(),
      userCan(user, "review.perform"),
      userCan(user, "review.assign"),
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
  const life = lifecycleOf(status);

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

  // The file at a glance: documents, rules and confirmations.
  const docsVerified = app.documents.filter((d) => d.status === "VERIFIED").length;
  const rules = computed.eligibility.rules;
  const rulesPassed = rules.filter((r) => r.outcome === "PASS").length;
  const required = computed.checklist.filter((row) => row.required);
  // Which stored files can be shown (UX-034): lost, unreadable or mislabelled files get a
  // designed state, not a broken frame.
  const stored = new Map(
    await Promise.all(
      app.documents
        .flatMap((d) => d.versions)
        .map(async (v) => [v.storageKey, await blobReadable(v.storageKey, v.mimeType)] as const),
    ),
  );
  const requiredVerified = required.filter((row) => row.statuses[0] === "VERIFIED").length;
  const missing = required.filter((row) => !row.statuses[0]).length;
  const confirmed = app.confirmations.filter((c) => c.status === "CONFIRMED").length;

  // What the officer does next, and the companion acting it out.
  const next =
    conflicts.length > 0
      ? "conflict"
      : canPerform && !app.assignedOfficerId && WORKING.includes(status)
        ? "take"
        : status === "SUBMITTED" && canWork
          ? "start"
          : editable
            ? "reviewing"
            : status === "ACTION_REQUIRED"
              ? "waiting"
              : status === "PENDING_CONFIRMATIONS"
                ? "confirmations"
                : status === "PENDING_DECISION"
                  ? "decision"
                  : DECIDED.includes(status)
                    ? "decided"
                    : "readOnly";
  const mood: BuddyMood =
    next === "conflict" || next === "waiting"
      ? "worried"
      : next === "confirmations"
        ? "waiting"
        : next === "decision"
          ? "badge"
          : next === "decided"
            ? life.state === "refused"
              ? "worried"
              : "celebrate"
            : next === "readOnly"
              ? "shield"
              : "documents";
  const danger = sla === "breached" || conflicts.length > 0;

  // Which tab opens first, and the one next step the floating button offers (UX-036).
  const docsToCheck = app.documents.filter(
    (d) => !["VERIFIED", "REJECTED", "INFECTED", "REJECTED_FILE"].includes(d.status),
  ).length;
  const openRequests = app.infoRequests.filter((r) => r.status === "OPEN").length;
  const canDecide = await userCan(user, "decision.make");
  const nextAction: NextAction | null =
    next === "take"
      ? { kind: "take", applicationId: app.id, selfId: user.id }
      : next === "start"
        ? { kind: "start", applicationId: app.id }
        : next === "reviewing"
          ? docsToCheck > 0
            ? { kind: "verify", left: docsToCheck }
            : { kind: "record", done: 0, total: VERIFICATION_ITEMS.length }
          : next === "waiting"
            ? { kind: "waiting" }
            : next === "confirmations"
              ? { kind: "confirmations" }
              : next === "decision"
                ? canDecide && !assignedToMe
                  ? { kind: "decide", applicationId: app.id }
                  : // The officer's part is done: on to their next file (or back to the queue).
                    { kind: "nextFile", applicationId: (await nextFileFor(user.id, app.id))?.id }
                : null;
  // While the officer reviews, the work has an order: ① check the documents, ② record and sign.
  const workflow = next === "reviewing";
  const guide: ConsoleGuide | undefined = workflow
    ? docsToCheck > 0
      ? {
          n: 1,
          total: 2,
          stepLabel: t("review.guide.step", { n: 1, total: 2 }),
          thenLabel: t("review.guide.then"),
          now: t("review.guide.verify", { count: docsToCheck }),
          then: t("review.guide.record"),
        }
      : {
          n: 2,
          total: 2,
          stepLabel: t("review.guide.step", { n: 2, total: 2 }),
          thenLabel: t("review.guide.then"),
          now: t("review.guide.record"),
        }
    : undefined;
  const tabParam = (await searchParams).tab;
  const TABS = ["documents", "application", "checks", "review", "history", "applicant"] as const;
  const initialTab: ConsoleTabKey =
    typeof tabParam === "string" && (TABS as readonly string[]).includes(tabParam)
      ? (tabParam as ConsoleTabKey)
      : next === "reviewing"
        ? docsToCheck > 0
          ? "documents"
          : "review"
        : next === "waiting"
          ? "history"
          : next === "confirmations"
            ? "checks"
            : next === "decision" || next === "decided"
              ? "review"
              : next === "take" || next === "start"
                ? "documents"
                : "application";

  // The applicant's profile photo, to check against the ID (UX-035).
  const photo = (await applicantPhotoUrls([app.applicantId])).get(app.applicantId) ?? null;
  return (
    <>
      <BreadcrumbTail
        label={app.referenceNo}
        parent={{ href: "/backoffice/queue", label: "queue" }}
      />
      <PageWidth wide />
      <ApplicationHeader
        back={{ href: "/backoffice/queue", label: t("review.backToQueue") }}
        title={app.applicant.fullName}
        typeLine={`${t(`categories.items.${app.category}.name`)} · ${t(`applicationTypes.${app.type}.name`)}`}
        reference={app.referenceNo}
        actions={
          <>
            <ApplicationStatusBadge status={status} />
            <SlaBadge
              state={sla}
              due={app.slaDueAt ? formatDay(app.slaDueAt, locale) : undefined}
            />
          </>
        }
      />

      {/* Where it stands (UX-028): the stage, the officer's next step, the file in numbers and
          the actions — the companion acting it out, the whole journey underneath. */}
      <section
        aria-labelledby="now-title"
        data-tone={danger ? "danger" : undefined}
        className="hero-surface relative flex animate-rise flex-col gap-6 overflow-hidden rounded-[1.75rem] p-5 sm:p-7"
      >
        <div className="flex items-center gap-4 sm:gap-6">
          {/* The applicant, large: the face to check against the ID; opens full size (UX-035). */}
          <ApplicantPhoto
            name={app.applicant.fullName}
            src={photo}
            size="xl"
            caption={app.referenceNo}
            className="self-start"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <span
              className={cn(
                "text-[0.7rem] font-bold tracking-widest uppercase",
                danger ? "text-destructive" : "text-link",
              )}
            >
              {t("review.eyebrow")}
            </span>
            <h2
              id="now-title"
              className="text-2xl leading-tight font-bold tracking-tight @3xl/main:text-3xl"
            >
              {t(`status.application.${status}`)}
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              {t(`review.hero.next.${next}`)}
            </p>
            <ul
              aria-label={t("review.overview")}
              className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground"
            >
              <HeroStat
                tone={docsVerified === app.documents.length ? "muted" : "now"}
                value={`${docsVerified}/${app.documents.length}`}
                label={t("review.stats.docsVerified")}
              />
              <HeroStat
                tone={rulesPassed === rules.length ? "muted" : "now"}
                value={`${rulesPassed}/${rules.length}`}
                label={t("review.stats.rulesPassed")}
              />
              {app.confirmations.length > 0 && (
                <HeroStat
                  tone={confirmed === app.confirmations.length ? "muted" : "now"}
                  value={`${confirmed}/${app.confirmations.length}`}
                  label={t("review.stats.confirmed")}
                />
              )}
              {missing > 0 && (
                <HeroStat tone="now" value={missing} label={t("review.stats.missing")} />
              )}
            </ul>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-3.5" aria-hidden />
                {t("review.officer")}:{" "}
                <span className="font-semibold text-foreground">
                  {app.assignedOfficer
                    ? assignedToMe
                      ? t("queue.you")
                      : app.assignedOfficer.fullName
                    : t("queue.unassigned")}
                </span>
              </span>
              {app.submittedAt && (
                <span>{t("queue.submitted", { date: formatDay(app.submittedAt, locale) })}</span>
              )}
              {snapshot && (
                <span title={snapshot.hash}>
                  {t("review.snapshot", {
                    version: snapshot.version,
                    hash: snapshot.hash.slice(0, 12),
                  })}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {/* FR-BO-002: a team lead (review.assign) may reassign or take over any open file. */}
              {(canLead || (canPerform && (!app.assignedOfficerId || assignedToMe))) &&
                ASSIGNABLE.includes(status) && (
                  <AssignDialog
                    applicationId={app.id}
                    reference={app.referenceNo}
                    currentOfficerId={app.assignedOfficerId}
                    officers={officers}
                    selfId={user.id}
                  />
                )}
              {/* While the form is open, Request information rides in its footer. */}
              <ReviewActions
                applicationId={app.id}
                selfId={user.id}
                // Assign to me and Start review live in the floating next-step button (UX-036).
                canTake={false}
                canStart={false}
                canRequest={false}
                canRecuse={canPerform && assignedToMe && WORKING.includes(status)}
                sections={sectionsFor(app.type, app.category)}
                documents={computed.checklist.map((row) => row.type as DocumentType)}
              />
            </div>
          </div>
          <div className="relative -my-2 -mr-2 hidden shrink-0 @lg/main:block">
            <span
              aria-hidden
              className={cn(
                "absolute top-4 right-[70%] z-10 hidden rounded-2xl rounded-br-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap @3xl/main:block",
                danger
                  ? "bg-destructive text-white"
                  : "bg-primary-soft text-primary-soft-foreground",
              )}
            >
              {t(`review.hero.bubble.${next}`)}
            </span>
            <LookAtPointer>
              <ProfileBuddy mood={mood} className="h-28 w-auto @3xl/main:h-32" />
            </LookAtPointer>
          </div>
        </div>
        <LifecycleTrack
          perspective="staff"
          index={life.index}
          state={life.state}
          className="rounded-2xl bg-card/70 px-2 pt-4 pb-3 ring-1 ring-foreground/[0.05] backdrop-blur-sm sm:px-4 dark:bg-surface-2/50 dark:ring-white/[0.06]"
        />
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

      {/* The file in tabs (UX-036): the tab with the next action opens first; the next step
          itself floats at the bottom right. */}
      <ConsoleTabs
        label={t("review.tabs.label")}
        initial={initialTab}
        guide={guide}
        tabs={[
          {
            key: "documents",
            label: t("review.tabs.documents"),
            todo: docsToCheck + missing,
            next: initialTab === "documents",
            step: workflow ? { n: 1, state: docsToCheck > 0 ? "now" : "done" } : undefined,
          },
          { key: "application", label: t("review.tabs.application") },
          {
            key: "checks",
            label: t("review.tabs.checks"),
            todo: rules.length - rulesPassed,
            next: initialTab === "checks",
          },
          {
            key: "review",
            label: t("review.tabs.review"),
            next: initialTab === "review",
            step: workflow ? { n: 2, state: docsToCheck > 0 ? "later" : "now" } : undefined,
          },
          {
            key: "history",
            label: t("review.tabs.history"),
            todo: openRequests,
            next: initialTab === "history",
          },
          { key: "applicant", label: t("review.tabs.applicant") },
        ]}
        panels={{
          documents: (
            <section aria-labelledby="docs-title" className={cn("flex flex-col gap-4", PANEL)}>
              <PanelTitle id="docs-title" icon={FileStack}>
                {t("review.documents", { count: app.documents.length })}
              </PanelTitle>
              <DocumentViewer
                locale={locale}
                canVerdict={canWork && WORKING.includes(status) && status !== "ACTION_REQUIRED"}
                documents={app.documents.map((d) => ({
                  id: d.id,
                  type: d.type,
                  status: d.status,
                  officerNote: d.officerNote,
                  // The storage key stays on the server; the viewer only learns whether the file exists.
                  versions: d.versions.map(({ storageKey, ...v }) => ({
                    ...v,
                    createdAt: v.createdAt.toISOString(),
                    available: stored.get(storageKey) ?? false,
                  })),
                }))}
                missing={required.filter((row) => !row.statuses[0]).map((row) => row.type)}
              />
            </section>
          ),
          application: (
            <section aria-labelledby="data-title" className={cn("flex flex-col gap-4", PANEL)}>
              <PanelTitle id="data-title" icon={ClipboardCheck}>
                {t("review.data")}
              </PanelTitle>
              <ApplicationSummary
                type={app.type}
                category={app.category}
                data={data}
                locale={locale}
                divisions={divisions}
              />
            </section>
          ),
          checks: (
            <>
              {/* Auto-computed evidence (FR-L-004), checklist and confirmations (FR-F-007). */}
              <div className="grid items-start gap-4 @3xl/main:grid-cols-2 @6xl/main:grid-cols-3">
                <section aria-labelledby="rules-title" className={cn("flex flex-col gap-4", PANEL)}>
                  <EvidenceHeader
                    id="rules-title"
                    icon={ScanSearch}
                    title={t("review.eligibility")}
                    hint={t("review.computedOutcome", {
                      outcome: t(`review.eligibilityOutcomes.${computed.eligibilityOutcome}`),
                    })}
                    done={rulesPassed}
                    total={rules.length}
                    label={t("review.rulesCount", { done: rulesPassed, total: rules.length })}
                  />
                  {rules.length > 0 ? (
                    <RuleRows rules={rules} locale={locale} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("review.noRules")}</p>
                  )}
                </section>

                <section
                  aria-labelledby="checklist-title"
                  className={cn("flex flex-col gap-4", PANEL)}
                >
                  <EvidenceHeader
                    id="checklist-title"
                    icon={ListChecks}
                    title={t("review.checklist")}
                    hint={t("review.computedOutcome", {
                      outcome: t(`review.documentationOutcomes.${computed.documentation}`),
                    })}
                    done={requiredVerified}
                    total={required.length}
                    label={t("review.checklistCount", {
                      done: requiredVerified,
                      total: required.length,
                    })}
                  />
                  <ul className={LIST_GROUP}>
                    {computed.checklist.map((row) => {
                      const docStatus = row.statuses[0];
                      const state: MarkState = docStatus
                        ? docStatus === "VERIFIED"
                          ? "done"
                          : DOC_FAILED.includes(docStatus)
                            ? "failed"
                            : "todo"
                        : row.required
                          ? "todo"
                          : "none";
                      return (
                        <li key={row.type} className={cn("flex items-center gap-3", LIST_ROW)}>
                          <Mark state={state} />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-sm font-medium">{docLabel(row.type)}</span>
                            <span className="text-xs text-muted-foreground">
                              {row.requirement === "M"
                                ? t("review.mandatory")
                                : t("review.conditional")}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-xs font-semibold",
                              state === "done"
                                ? "text-link"
                                : state === "failed"
                                  ? "text-destructive"
                                  : "text-muted-foreground",
                            )}
                          >
                            {t(`review.docStatus.${docStatus ?? "MISSING"}`)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section
                  aria-labelledby="confirm-title"
                  className={cn("flex flex-col gap-4 @3xl/main:@max-6xl/main:col-span-2", PANEL)}
                >
                  {app.confirmations.length > 0 ? (
                    <EvidenceHeader
                      id="confirm-title"
                      icon={Handshake}
                      title={t("review.confirmations")}
                      done={confirmed}
                      total={app.confirmations.length}
                      label={t("review.confirmedCount", {
                        done: confirmed,
                        total: app.confirmations.length,
                      })}
                    />
                  ) : (
                    <PanelTitle id="confirm-title" icon={Handshake}>
                      {t("review.confirmations")}
                    </PanelTitle>
                  )}
                  {app.confirmations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("review.noConfirmations")}</p>
                  ) : (
                    <ul className={LIST_GROUP}>
                      {app.confirmations.map((c) => {
                        const state = CONFIRMATION_MARKS[c.status as ConfirmationStatus];
                        return (
                          <li key={c.id} className={cn("flex flex-col gap-2", LIST_ROW, "py-3")}>
                            <div className="flex items-center gap-3">
                              <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-foreground">
                                {initials(c.addressee.fullName)}
                                <Mark
                                  state={state}
                                  className="absolute -right-1 -bottom-1 size-4 bg-card [&_svg]:size-2.5"
                                />
                              </span>
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-semibold">
                                  {c.addressee.fullName}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {t(`review.confirmationKinds.${c.kind}`)} ·{" "}
                                  {c.respondedAt
                                    ? t("review.respondedOn", {
                                        date: formatDay(c.respondedAt, locale),
                                      })
                                    : t("review.dueOn", { date: formatDay(c.dueAt, locale) })}
                                </span>
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 text-xs font-semibold",
                                  state === "done"
                                    ? "text-link"
                                    : state === "failed"
                                      ? "text-destructive"
                                      : "text-muted-foreground",
                                )}
                              >
                                {t(`status.confirmation.${c.status}`)}
                              </span>
                            </div>
                            {c.reason && <p className="pl-12 text-sm">“{c.reason}”</p>}
                            {c.overriddenById && (
                              <p className="pl-12 text-xs text-muted-foreground">
                                {t("review.overriddenBy", {
                                  name: names[c.overriddenById] ?? "—",
                                  reason: c.overrideReason ?? "",
                                })}
                              </p>
                            )}
                            {canOverride && c.status === "PENDING" && (
                              <div className="pl-12">
                                <ConfirmationOverride id={c.id} name={c.addressee.fullName} />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </>
          ),
          review: (
            <>
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
                  requestInfo={{
                    sections: sectionsFor(app.type, app.category),
                    documents: computed.checklist.map((row) => row.type as DocumentType),
                  }}
                />
              ) : signed.length === 0 ? (
                <section
                  aria-labelledby="section-l-placeholder"
                  className={cn(
                    "flex flex-col items-center gap-3 text-center",
                    PANEL,
                    "py-10 sm:py-10",
                  )}
                >
                  <span className="relative inline-flex size-14 items-center justify-center">
                    <span aria-hidden className="absolute inset-0 rounded-2xl bg-primary-soft" />
                    <Play className="relative size-6 text-link" aria-hidden />
                  </span>
                  <h2 id="section-l-placeholder" className="text-lg">
                    {t("review.form.title")}
                  </h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    {status === "SUBMITTED" && canWork
                      ? t("review.startFirst")
                      : t("review.notStarted")}
                  </p>
                </section>
              ) : null}

              {signed.length > 0 && (
                <section
                  aria-labelledby="signed-title"
                  className={cn("flex flex-col gap-4", PANEL)}
                >
                  <PanelTitle id="signed-title" icon={Signature}>
                    {t("review.signedReviews", { count: signed.length })}
                  </PanelTitle>
                  <SignedReview review={toSignedReview(signed[0]!)} locale={locale} />
                  {signed.slice(1).map((r) => (
                    <details
                      key={r.id}
                      className="group rounded-2xl p-4 ring-1 ring-foreground/[0.07] dark:bg-surface-2/50 dark:ring-white/[0.06]"
                    >
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
            </>
          ),
          history: (
            <div className="flex flex-col gap-4">
              <section
                aria-labelledby="timeline-title"
                className={cn("flex flex-col gap-4", PANEL)}
              >
                <PanelTitle id="timeline-title" icon={History}>
                  {t("review.timeline.title")}
                </PanelTitle>
                {steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("review.timeline.empty")}</p>
                ) : (
                  <StatusTimeline steps={steps} />
                )}
              </section>

              <section aria-labelledby="rounds-title" className={cn("flex flex-col gap-4", PANEL)}>
                <PanelTitle id="rounds-title" icon={MessageSquare}>
                  {t("review.rounds.title")}
                </PanelTitle>
                {app.infoRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("review.rounds.empty")}</p>
                ) : (
                  <ol className={LIST_GROUP}>
                    {app.infoRequests.map((r, index) => (
                      <li key={r.id} className={cn("flex flex-col gap-2", LIST_ROW, "py-3.5")}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {t("review.rounds.round", { n: app.infoRequests.length - index })} ·{" "}
                            {t.has(`review.request.templates.${r.template}.label`)
                              ? t(`review.request.templates.${r.template}.label`)
                              : r.template}
                          </span>
                          {r.status === "OPEN" ? (
                            <AttentionPill>{t(`review.rounds.status.${r.status}`)}</AttentionPill>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <Mark
                                state={r.status === "RESPONDED" ? "done" : "none"}
                                className="size-5"
                              />
                              {t(`review.rounds.status.${r.status}`)}
                            </span>
                          )}
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
                              <dt className="text-muted-foreground">
                                {t("review.rounds.responded")}
                              </dt>
                              <dd>{formatDateTime(r.respondedAt, locale)}</dd>
                            </>
                          )}
                          {r.sections.length > 0 && (
                            <>
                              <dt className="text-muted-foreground">
                                {t("review.rounds.sections")}
                              </dt>
                              <dd>{r.sections.map((s) => s.toUpperCase()).join(", ")}</dd>
                            </>
                          )}
                          {(r.documents.length > 0 || r.extraDocument) && (
                            <>
                              <dt className="text-muted-foreground">
                                {t("review.rounds.documents")}
                              </dt>
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
          ),
          applicant: (
            <>
              {/* FR-BO-006: 360° view of the applicant. */}
              <section
                aria-labelledby="applicant-title"
                className={cn("flex flex-col gap-4", PANEL)}
              >
                <PanelTitle id="applicant-title" icon={UserRound}>
                  {t("review.applicant.title")}
                </PanelTitle>
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
                    <dd>
                      {overview.user.mfaMethods.length > 0 ? t("summary.yes") : t("summary.no")}
                    </dd>
                  </dl>
                )}
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t("review.applicant.licences", { count: overview.licences.length })}
                  </h3>
                  {overview.licences.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("review.applicant.noLicences")}
                    </p>
                  ) : (
                    <ul className={LIST_GROUP}>
                      {overview.licences.map((l) => (
                        <li
                          key={l.id}
                          className={cn(
                            "flex flex-wrap items-center justify-between gap-2",
                            LIST_ROW,
                          )}
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="font-mono text-sm font-semibold">{l.licenceNo}</span>
                            <span className="text-xs text-muted-foreground">
                              {t(`categories.items.${l.category}.name`)} ·{" "}
                              {t("review.applicant.expires", {
                                date: formatDay(l.expiresAt, locale),
                              })}
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
                  <ul className={LIST_GROUP}>
                    {overview.applications.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/backoffice/review/${a.id}` as Route}
                          aria-current={a.id === app.id ? "page" : undefined}
                          className={cn(
                            "flex flex-wrap items-center justify-between gap-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:ring-inset aria-[current=page]:bg-primary/[0.07] dark:aria-[current=page]:bg-primary/[0.16]",
                            LIST_ROW,
                          )}
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

                {/* Affiliations, licence history (sanctions), payments and communications. */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t("review.applicant.affiliations", { count: overview.affiliations.length })}
                  </h3>
                  {overview.affiliations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("review.applicant.noAffiliations")}
                    </p>
                  ) : (
                    <ul className={LIST_GROUP} data-testid="applicant-affiliations">
                      {overview.affiliations.map((a) => (
                        <li
                          key={a.id}
                          className={cn(
                            "flex flex-wrap items-center justify-between gap-2",
                            LIST_ROW,
                          )}
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-semibold">
                              {a.firm.tradingName || a.firm.legalName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              <span className="font-mono">{a.licence.licenceNo}</span> ·{" "}
                              {a.endsOn
                                ? t("review.applicant.period", {
                                    from: formatDay(a.startsOn, locale),
                                    to: formatDay(a.endsOn, locale),
                                  })
                                : t("review.applicant.affiliatedSince", {
                                    date: formatDay(a.startsOn, locale),
                                  })}
                            </span>
                          </span>
                          <Mark state={a.endsOn ? "none" : "done"} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t("review.applicant.history")}
                  </h3>
                  {overview.licenceEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("review.applicant.noHistory")}
                    </p>
                  ) : (
                    <ul className={LIST_GROUP} data-testid="applicant-history">
                      {overview.licenceEvents.map((e) => {
                        const sanction = ["SUSPEND", "REVOKE"].includes(e.action);
                        return (
                          <li key={e.id} className={cn("flex items-start gap-3", LIST_ROW)}>
                            <Mark state={sanction ? "failed" : "done"} className="mt-0.5" />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="text-sm font-medium">
                                {t.has(`registerAdmin.events.${e.action}`)
                                  ? t(
                                      `registerAdmin.events.${e.action}` as "registerAdmin.events.ISSUED",
                                    )
                                  : e.action}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                <span className="font-mono">{e.licence.licenceNo}</span> ·{" "}
                                {formatDay(e.at, locale)}
                                {e.reason ? ` · ${e.reason}` : ""}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t("review.applicant.payments", { count: overview.payments.length })}
                  </h3>
                  {overview.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("review.applicant.noPayments")}
                    </p>
                  ) : (
                    <ul className={LIST_GROUP} data-testid="applicant-payments">
                      {overview.payments.map((p) => (
                        <li
                          key={p.id}
                          className={cn(
                            "flex flex-wrap items-center justify-between gap-2",
                            LIST_ROW,
                          )}
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-semibold num">
                              {formatMoney(p.amount, p.currency, locale)}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              <span className="font-mono">{p.receiptNo ?? p.reference}</span> ·{" "}
                              {p.application.referenceNo} ·{" "}
                              {formatDay(p.paidAt ?? p.createdAt, locale)}
                            </span>
                          </span>
                          <PaymentStatusBadge status={p.status as PaymentStatus} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t("review.applicant.communications")}
                  </h3>
                  {overview.notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("review.applicant.noCommunications")}
                    </p>
                  ) : (
                    <ul className={LIST_GROUP} data-testid="applicant-communications">
                      {overview.notifications.map((n) => {
                        const key = `inbox.${n.messageKey}.title`;
                        return (
                          <li key={n.id} className={cn("flex flex-col", LIST_ROW)}>
                            <span className="text-sm font-medium">
                              {t.has(key)
                                ? t(
                                    key as "inbox.assigned.title",
                                    (n.values ?? {}) as Record<string, string>,
                                  )
                                : n.messageKey}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {n.code} · {formatDateTime(n.createdAt, locale)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            </>
          ),
        }}
      />
      {nextAction && (
        <NextActionDock
          action={nextAction}
          hideOn={editable ? "review" : undefined}
          initialTab={initialTab}
        />
      )}
      <ValidationCelebration
        kind="review"
        reference={app.referenceNo}
        nextHref={
          nextAction?.kind === "nextFile" && nextAction.applicationId
            ? `/backoffice/review/${nextAction.applicationId}`
            : undefined
        }
      />
    </>
  );
}

/** One number in the hero (read, not pressed): a dot, the value and a word. */
function HeroStat({
  tone,
  value,
  label,
}: {
  tone: "now" | "muted";
  value: React.ReactNode;
  label: React.ReactNode;
}) {
  return (
    <li className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          tone === "now" ? "missing-mark bg-sun" : "bg-primary",
        )}
      />
      <span className="font-bold num text-foreground">{value}</span>
      {label}
    </li>
  );
}

/** An evidence panel's heading: progress ring, title and the computed outcome. */
function EvidenceHeader({
  id,
  icon: Icon,
  title,
  hint,
  done,
  total,
  label,
}: {
  id: string;
  icon: typeof ClipboardCheck;
  title: string;
  hint?: string;
  done: number;
  total: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <ProgressRing value={done} total={total} thickness={3.5} className="size-11" label={label}>
        {total > 0 ? (
          <span className="text-[0.7rem] font-bold num">
            {done}/{total}
          </span>
        ) : (
          <Icon className="size-4 text-link" aria-hidden />
        )}
      </ProgressRing>
      <div className="flex min-w-0 flex-col">
        <h2 id={id} className="text-lg">
          {title}
        </h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
