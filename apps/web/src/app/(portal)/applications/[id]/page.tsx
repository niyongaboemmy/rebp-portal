import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  APPLICATION_STATUS_TONES,
  CONFIRMATION_STATUS_TONES,
  WITHDRAWABLE_STATUSES,
  type ApplicationStatus,
} from "@rebp/contracts";
import {
  ArrowRight,
  Bell,
  Clock3,
  CreditCard,
  Download,
  FileText,
  MessageSquare,
  PenLine,
  Receipt,
  Wallet,
} from "@/components/icons";
import { ApplicationActions, RemindButton } from "@/components/applications/application-actions";
import { PaymentStatusBadge } from "@/components/applications/status-badges";
import { Suspense } from "react";
import { SubmissionCelebration } from "@/components/applications/submission-celebration";
import { LifecycleTrack } from "@/components/applications/lifecycle-track";
import { LiveRefresh } from "@/components/applications/live-refresh";
import { ProgressRing } from "@/components/data/progress-ring";
import { LookAtPointer } from "@/components/motion/look-at-pointer";
import { ProfileBuddy } from "@/components/profile/profile-buddy";
import { LIFECYCLE, lifecycleOf, moodForStatus } from "@/lib/lifecycle";
import { relativeLabel } from "@/lib/relative-time";
import { notificationsAbout } from "@/server/notifications/inbox";
import { StatusTimeline, type TimelineStep } from "@/components/data/status-timeline";
import { Button } from "@/components/ui/button";
import { cn, initials } from "@/lib/utils";
import { ApplicationHeader } from "@/components/applications/application-header";
import { PANEL, PANEL_ROW } from "@/components/ui/surface";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatDay, formatMoney } from "@/lib/format";
import { applicationForOwner } from "@/server/applications/applications";
import { requireUser } from "@/server/auth/guards";
import { BreadcrumbTail } from "@/components/layout/breadcrumbs";

export async function generateMetadata({
  params,
}: PageProps<"/applications/[id]">): Promise<Metadata> {
  const t = await getTranslations("applications.detail");
  return { title: t("metaTitle", { id: (await params).id.slice(0, 8) }) };
}

/** What happens next, in plain words, with the SLA expectation (FR-PORTAL-002). */
const NEXT: Partial<Record<ApplicationStatus, string>> = {
  DRAFT: "draft",
  PENDING_PAYMENT: "payment",
  PENDING_CONFIRMATIONS: "confirmations",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "review",
  ACTION_REQUIRED: "action",
  FURTHER_ASSESSMENT: "assessment",
  PENDING_DECISION: "decision",
  LICENSE_ISSUED: "issued",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  EXPIRED_DRAFT: "expired",
};

/**
 * Application status (FR-PORTAL-001…004): journey, timeline of every state change with dates,
 * the next step and its normal timing, confirmations (with a reminder button), information
 * requests, officer comments, the decision, and every downloadable document (FR-PORTAL-003).
 */
export default async function ApplicationPage({ params }: PageProps<"/applications/[id]">) {
  const { user } = await requireUser();
  const { id } = await params;
  const app = await applicationForOwner(id, user);
  if (!app) notFound();
  const [t, ts, tc, tw, locale] = await Promise.all([
    getTranslations("applications.detail"),
    getTranslations("status"),
    getTranslations("categories.items"),
    getTranslations("wizard"),
    getLocale(),
  ]);
  const openRequest = app.infoRequests.find((r) => r.status === "OPEN");
  const decision = app.decisions[0];
  const licence = app.licences[0];
  const paid = app.payments.filter((p) => p.status === "PAID" || p.status === "WAIVED");
  const comment = app.reviews[0]?.applicantComment;

  const steps: TimelineStep[] = app.events.map((event, index) => ({
    key: String(event.id),
    title: ts(`application.${event.toStatus}`),
    meta: formatDateTime(event.at, locale),
    state: index === app.events.length - 1 ? "current" : "done",
    tone: index === app.events.length - 1 ? APPLICATION_STATUS_TONES[event.toStatus] : undefined,
  }));
  const nextKey = NEXT[app.status];

  const { index: lifeIndex, state: lifeState } = lifecycleOf(app.status, app.lastStep);
  const mood = moodForStatus(app.status);
  const updates = await notificationsAbout(user.id, app.id);
  const [ti, tm] = await Promise.all([getTranslations("inbox"), getTranslations("time")]);
  const now = new Date();
  const confirmations = app.confirmations.filter((c) => c.status !== "CANCELLED");
  const confirmed = confirmations.filter((c) => c.status === "CONFIRMED").length;
  const cta =
    app.status === "DRAFT" || app.status === "ACTION_REQUIRED" || app.status === "PENDING_PAYMENT"
      ? {
          href: (app.status === "PENDING_PAYMENT"
            ? `/applications/${app.id}/pay`
            : `/applications/${app.id}/wizard`) as Route,
          icon: app.status === "PENDING_PAYMENT" ? CreditCard : PenLine,
          label: t(`cta.${app.status}`),
        }
      : null;
  const danger = lifeState === "attention" || lifeState === "refused";

  return (
    <>
      <BreadcrumbTail label={app.referenceNo} />
      <ApplicationHeader
        back={{ href: "/applications", label: t("back") }}
        title={tc(`${app.category}.name`)}
        typeLine={tw(`typeLine.${app.type}`)}
        reference={app.referenceNo}
        actions={
          <>
            <LiveRefresh />
            <ApplicationActions
              applicationId={app.id}
              status={app.status}
              withdrawable={(WITHDRAWABLE_STATUSES as readonly string[]).includes(app.status)}
            />
          </>
        }
      />
      <Suspense>
        <SubmissionCelebration
          kind="submitted"
          reference={app.referenceNo}
          category={tc(`${app.category}.name`)}
        />
        {app.status === "LICENSE_ISSUED" && licence && (
          <SubmissionCelebration
            kind="issued"
            reference={licence.licenceNo}
            category={tc(`${app.category}.name`)}
            seenKey={`rebp:issued:${licence.licenceNo}`}
          />
        )}
      </Suspense>

      {/* Where it stands (UX-028): the stage in words, what happens next, the one action, a
          companion acting it out — and the whole journey underneath. */}
      <section
        aria-labelledby="now-title"
        data-tone={danger ? "danger" : undefined}
        className="hero-surface relative flex flex-col gap-6 overflow-hidden rounded-[1.75rem] p-5 sm:p-7"
      >
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <span
              className={cn(
                "text-[0.7rem] font-bold tracking-widest uppercase",
                danger ? "text-destructive" : "text-link",
              )}
            >
              {lifeState === "done"
                ? t("hero.complete")
                : t("hero.eyebrow", { n: lifeIndex + 1, total: LIFECYCLE.length })}
            </span>
            <h2
              id="now-title"
              className="text-2xl leading-tight font-bold tracking-tight @3xl/main:text-3xl"
            >
              {ts(`application.${app.status}`)}
            </h2>
            {nextKey && (
              <p className="max-w-xl text-sm text-muted-foreground">{t(`next.${nextKey}`)}</p>
            )}
            {app.status === "DRAFT" && app.lastStep && app.lastStep !== "a" && (
              <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold ring-1 ring-foreground/[0.06] dark:bg-surface-2 dark:ring-white/[0.06]">
                <PenLine className="size-3.5 text-link" aria-hidden />
                {t("resumeAt", { step: tw(`steps.${app.lastStep as "b"}.title`) })}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {cta && (
                <Button asChild size="lg" className="group rounded-full">
                  <Link href={cta.href}>
                    <cta.icon aria-hidden /> {cta.label}
                    <ArrowRight
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </Button>
              )}
              {licence && (
                <Button asChild size="lg" className="group rounded-full">
                  <Link href={`/licenses/${licence.id}` as Route}>
                    <Wallet aria-hidden /> {t("viewLicence", { number: licence.licenceNo })}
                  </Link>
                </Button>
              )}
            </div>
          </div>
          {/* The companion acts out the stage: writing, paying, waiting, celebrating, worried. */}
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
              {t(`hero.bubble.${mood}`)}
            </span>
            <LookAtPointer>
              <ProfileBuddy mood={mood} className="h-32 w-auto @3xl/main:h-36" />
            </LookAtPointer>
          </div>
        </div>
        {/* The journey on its own glass shelf, under the companion — never behind it. */}
        <LifecycleTrack
          index={lifeIndex}
          state={lifeState}
          className="rounded-2xl bg-card/70 px-2 pt-4 pb-3 ring-1 ring-foreground/[0.05] backdrop-blur-sm sm:px-4 dark:bg-surface-2/50 dark:ring-white/[0.06]"
        />
      </section>

      <div className="grid items-start gap-4 @3xl/main:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {openRequest && (
            <section
              aria-labelledby="request-title"
              className={cn("flex flex-col gap-3 ring-2 ring-sun/60", PANEL)}
            >
              <h2 id="request-title" className="inline-flex items-center gap-2.5 text-lg">
                <span className="relative inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-link">
                  <MessageSquare className="size-[1.1rem]" aria-hidden />
                  <span
                    aria-hidden
                    className="missing-mark absolute -top-1 -right-1 size-3 rounded-full bg-sun ring-2 ring-card"
                  />
                </span>
                {t("requestTitle")}
              </h2>
              <p className="text-sm whitespace-pre-line">{openRequest.message}</p>
              <p className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden />
                {t("requestDue", { date: formatDay(openRequest.dueAt, locale) })}
              </p>
            </section>
          )}

          {confirmations.length > 0 && (
            <section aria-labelledby="confirm-title" className={cn("flex flex-col gap-4", PANEL)}>
              <div className="flex items-center gap-3">
                <ProgressRing
                  value={confirmed}
                  total={confirmations.length}
                  thickness={3.5}
                  className="size-11"
                  label={t("confirmedCount", { done: confirmed, total: confirmations.length })}
                >
                  <span className="text-xs font-bold num">
                    {confirmed}/{confirmations.length}
                  </span>
                </ProgressRing>
                <div className="flex flex-col">
                  <h2 id="confirm-title" className="text-lg">
                    {t("confirmationsTitle")}
                  </h2>
                  <span className="text-xs text-muted-foreground">{t("confirmationsHint")}</span>
                </div>
              </div>
              <ul className="flex flex-col divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl ring-1 ring-foreground/[0.06] dark:divide-white/[0.06] dark:ring-white/[0.06]">
                {confirmations.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                    <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-foreground">
                      {initials(c.addressee.fullName)}
                      {c.status === "PENDING" && (
                        <span
                          aria-hidden
                          className="missing-mark absolute -top-0.5 -right-0.5 size-3 rounded-full bg-sun ring-2 ring-card"
                        />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{c.addressee.fullName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t(`confirmationKinds.${c.kind}`)}
                        {c.status === "PENDING" &&
                          ` · ${t("dueBy", { date: formatDay(c.dueAt, locale) })}`}
                        {c.reason && ` · “${c.reason}”`}
                      </span>
                    </div>
                    <StatusBadge
                      tone={CONFIRMATION_STATUS_TONES[c.status]}
                      label={ts(`confirmation.${c.status}`)}
                    />
                    {c.status === "PENDING" && <RemindButton confirmationId={c.id} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {comment && (
            <section aria-labelledby="comment-title" className={cn("flex flex-col gap-2", PANEL)}>
              <h2 id="comment-title" className="inline-flex items-center gap-2 text-lg">
                <MessageSquare className="size-5 text-link" aria-hidden /> {t("officerComment")}
              </h2>
              <p className="text-sm whitespace-pre-line">{comment}</p>
            </section>
          )}

          {decision && (
            <section aria-labelledby="decision-title" className={cn("flex flex-col gap-3", PANEL)}>
              <h2 id="decision-title" className="text-lg">
                {t("decisionTitle")}
              </h2>
              <p className="text-sm">
                {t("decisionLine", {
                  decision: t(`decisions.${decision.decision}`),
                  date: formatDay(decision.signedAt, locale),
                })}
              </p>
              {decision.reasons && (
                <p className={cn("p-3 text-sm whitespace-pre-line", PANEL_ROW)}>
                  {decision.reasons}
                </p>
              )}
            </section>
          )}

          {/* Updates about this application, as they were sent (email, SMS and the bell). */}
          <section aria-labelledby="updates-title" className={cn("flex flex-col gap-3", PANEL)}>
            <h2 id="updates-title" className="inline-flex items-center gap-2 text-lg">
              <Bell className="size-5 text-link" aria-hidden /> {t("updatesTitle")}
            </h2>
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("updatesEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {updates.map((n) => {
                  const key = n.messageKey as "submitted";
                  const values = (n.values ?? {}) as Record<string, string>;
                  return (
                    <li key={n.id} className="flex gap-3 rounded-xl px-1 py-2">
                      <span className="relative mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-link">
                        <Bell className="size-4" aria-hidden />
                        {!n.readAt && (
                          <span
                            aria-hidden
                            className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
                          />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold">
                          {ti.has(`${key}.title`) ? ti(`${key}.title`, values) : n.code}
                        </span>
                        {ti.has(`${key}.body`) && (
                          <span className="text-xs leading-relaxed text-muted-foreground">
                            {ti(`${key}.body`, values)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                        {relativeLabel(n.createdAt, now, tm, (d) => formatDay(d, locale))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          {steps.length > 0 && (
            <section aria-labelledby="timeline-title" className={cn("flex flex-col gap-4", PANEL)}>
              <h2 id="timeline-title" className="text-lg">
                {t("timeline")}
              </h2>
              <StatusTimeline steps={steps} />
            </section>
          )}

          <section aria-labelledby="files-title" className={cn("flex flex-col gap-3", PANEL)}>
            <h2 id="files-title" className="text-lg">
              {t("files")}
            </h2>
            <ul className="flex flex-col gap-2">
              {app.submittedAt && (
                <FileLink
                  href={`/api/files/acknowledgment/${app.id}`}
                  label={t("acknowledgment")}
                />
              )}
              {paid.map((p) => (
                <FileLink
                  key={p.id}
                  href={`/api/files/receipt/${p.id}`}
                  label={t("receipt", { number: p.receiptNo ?? p.reference })}
                  icon="receipt"
                />
              ))}
              {decision && (
                <FileLink
                  href={`/api/files/letter/${decision.id}`}
                  label={t("letter", { number: decision.letterNo })}
                />
              )}
              {licence && (
                <FileLink href={`/api/files/certificate/${licence.id}`} label={t("certificate")} />
              )}
              {!app.submittedAt && paid.length === 0 && !decision && (
                <li className="text-sm text-muted-foreground">{t("noFiles")}</li>
              )}
            </ul>
          </section>

          {app.payments.length > 0 && (
            <section aria-labelledby="payments-title" className={cn("flex flex-col gap-3", PANEL)}>
              <h2 id="payments-title" className="text-lg">
                {t("payments")}
              </h2>
              <ul className="flex flex-col gap-2">
                {app.payments.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm",
                      PANEL_ROW,
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-mono text-xs font-semibold">
                        {p.reference}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(p.createdAt, locale)}
                      </span>
                    </span>
                    <span className="font-semibold num">
                      {formatMoney(p.amount, p.currency, locale)}
                    </span>
                    <PaymentStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {app.snapshots[0] && (
            <p className="px-1 text-xs text-muted-foreground">
              {t("fingerprint", { version: app.snapshots[0].version })}{" "}
              <span className="font-mono break-all">{app.snapshots[0].hash.slice(0, 24)}…</span>
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function FileLink({
  href,
  label,
  icon = "file",
}: {
  href: string;
  label: string;
  icon?: "file" | "receipt";
}) {
  const Icon = icon === "receipt" ? Receipt : FileText;
  return (
    <li>
      <a
        href={`${href}?download=1`}
        className={cn(
          "flex items-center gap-3 px-3.5 py-3 text-sm font-medium transition-colors hover:text-link",
          PANEL_ROW,
        )}
      >
        <Icon className="size-4 text-link" aria-hidden />
        <span className="flex-1">{label}</span>
        <Download className="size-4 text-muted-foreground" aria-hidden />
      </a>
    </li>
  );
}
