import {
  ArrowRight,
  Award,
  ChevronDown,
  ClipboardCheck,
  FileDown,
  Gavel,
  ScanSearch,
  ScrollText,
  ShieldAlert,
  Signature,
} from "@/components/icons";
import { applicantPhotoUrls } from "@/server/profile/documents";
import { ApplicantPhoto } from "@/components/applications/applicant-photo";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  VERIFICATION_ITEMS,
  type ApplicationStatus,
  type DecisionCondition,
  type LicenseStatus,
  type StatusTone,
} from "@rebp/contracts";
import { ApplicationHeader } from "@/components/applications/application-header";
import { ApplicationSummary } from "@/components/applications/application-summary";
import { LifecycleTrack } from "@/components/applications/lifecycle-track";
import { BreadcrumbTail } from "@/components/layout/breadcrumbs";
import { PageWidth } from "@/components/layout/page-width";
import { LookAtPointer } from "@/components/motion/look-at-pointer";
import { ProfileBuddy, type BuddyMood } from "@/components/profile/profile-buddy";
import { AttentionPill, LIST_GROUP, LIST_ROW, Mark } from "@/components/review/marks";
import { ValidationCelebration } from "@/components/review/validation-celebration";
import { RuleRows } from "@/components/review/rule-rows";
import {
  ApplicationStatusBadge,
  LicenceStatusBadge,
} from "@/components/applications/status-badges";
import { CorrectDecisionDialog } from "@/components/review/correct-decision-dialog";
import { DecisionForm } from "@/components/review/decision-form";
import {
  RECOMMENDATION_TONES,
  SignedReview,
  toSignedReview,
} from "@/components/review/signed-review";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PANEL } from "@/components/ui/surface";
import { formatDateTime, formatDay } from "@/lib/format";
import { lifecycleOf } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";
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
import { derivedArrangement } from "@/server/licensing/licensing";

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

  // BR-091 / BR-093: show why this approver may not decide, and disable the form. The same
  // rule decides who may correct a recorded decision (FR-M-017).
  let block: { key: string; reasons: string[] } | null = null;
  if (pending || decision) {
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

  const life = lifecycleOf(status);
  const signedReview = review ? toSignedReview(review) : null;
  const overrides = signedReview?.computed.overridden ?? {};
  const overrideKeys = (["documentation", "eligibility"] as const).filter((k) => overrides[k]);
  // "Not applicable" is a complete answer: count verified checks among the applicable ones.
  const verifiedChecks = signedReview
    ? VERIFICATION_ITEMS.filter((item) => signedReview.checks[item]?.outcome === "VERIFIED").length
    : 0;
  const applicableChecks = signedReview
    ? VERIFICATION_ITEMS.filter((item) => signedReview.checks[item]?.outcome !== "NA").length
    : VERIFICATION_ITEMS.length;
  const blocking = computed.eligibility.rules.filter((r) => r.outcome !== "PASS").length;
  const approved =
    decision?.decision === "APPROVED" || decision?.decision === "APPROVED_WITH_CONDITIONS";
  const mood: BuddyMood = decision
    ? approved
      ? "celebrate"
      : "worried"
    : pending && block
      ? "lock"
      : pending
        ? "badge"
        : "waiting";
  const danger = (pending && Boolean(block)) || decision?.decision === "REJECTED";
  const arrangement = decision?.practiceArrangement ?? derivedArrangement(app);
  const corrected = decision?.correctsId
    ? app.decisions.find((d) => d.id === decision.correctsId)
    : undefined;
  const arrangementLabel = (value: string) =>
    t.has(`arrangements.${value}`) ? t(`arrangements.${value}` as "arrangements.FIRM") : value;

  // The applicant's profile photo, to check against the ID (UX-035).
  const photo = (await applicantPhotoUrls([app.applicantId])).get(app.applicantId) ?? null;
  return (
    <>
      <BreadcrumbTail
        label={app.referenceNo}
        parent={{ href: "/backoffice/decisions", label: "decisions" }}
      />
      <PageWidth wide />
      <ApplicationHeader
        back={{ href: "/backoffice/decisions", label: t("decide.back") }}
        title={app.applicant.fullName}
        typeLine={`${t(`categories.items.${app.category}.name`)} · ${t(`applicationTypes.${app.type}.name`)}`}
        reference={app.referenceNo}
        actions={
          <>
            <ApplicationStatusBadge status={status} />
            <Button asChild variant="ghost" size="sm" className="group">
              <Link href={`/backoffice/review/${app.id}` as Route}>
                {t("decide.openReview")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </>
        }
      />

      {/* The signed review in a glance (FR-M-001): who recommends what, how the checks came out
          and whether the officer overrode the engine — the journey underneath. */}
      <section
        aria-labelledby="summary-title"
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
              {t("decide.eyebrow")}
            </span>
            <h2
              id="summary-title"
              className="text-2xl leading-tight font-bold tracking-tight @3xl/main:text-3xl"
            >
              {decision
                ? t(`decision.types.${decision.decision}`)
                : review?.recommendation
                  ? t("decide.hero.recommends", {
                      name: review.officer.fullName,
                      recommendation: t(`review.recommendations.${review.recommendation}.label`),
                    })
                  : t("decide.noReview")}
            </h2>
            {signedReview && (
              <p className="max-w-xl text-sm text-muted-foreground">
                {t("decide.hero.signed", {
                  name: signedReview.officerName,
                  date: formatDateTime(signedReview.signedAt, locale),
                })}
              </p>
            )}
            {signedReview && (
              <ul
                aria-label={t("decide.review")}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                {review?.recommendation && (
                  <li>
                    <StatusBadge
                      tone={RECOMMENDATION_TONES[review.recommendation] ?? "neutral"}
                      label={t(`review.recommendations.${review.recommendation}.label`)}
                    />
                  </li>
                )}
                <li className="inline-flex items-center gap-1.5 rounded-full bg-card/70 py-0.5 pr-2.5 pl-1 text-xs font-semibold ring-1 ring-foreground/[0.06] dark:bg-surface-2/50 dark:ring-white/[0.06]">
                  <Mark
                    state={verifiedChecks === applicableChecks ? "done" : "todo"}
                    className="size-5"
                  />
                  {t("decide.hero.checks", {
                    done: verifiedChecks,
                    total: applicableChecks,
                  })}
                </li>
                {overrideKeys.length === 0 ? (
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-card/70 py-0.5 pr-2.5 pl-1 text-xs font-semibold ring-1 ring-foreground/[0.06] dark:bg-surface-2/50 dark:ring-white/[0.06]">
                    <Mark state="done" className="size-5" />
                    {t("decide.hero.noOverrides")}
                  </li>
                ) : (
                  overrideKeys.map((key) => (
                    <li key={key}>
                      <AttentionPill>{t(`decide.hero.overridden.${key}`)}</AttentionPill>
                    </li>
                  ))
                )}
                {blocking > 0 && (
                  <li>
                    <AttentionPill>
                      {t("decide.hero.rulesToLook", { count: blocking })}
                    </AttentionPill>
                  </li>
                )}
              </ul>
            )}
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
              {t(`decide.hero.bubble.${mood}`)}
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

      <ValidationCelebration kind="decision" reference={app.referenceNo} />
      {recorded && decision && (
        <Alert variant="success" title={t("decide.recordedTitle")}>
          {t("decide.recordedBody", { letter: decision.letterNo })}
        </Alert>
      )}

      {pending && block && (
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

      <div className="grid items-start gap-4 @3xl/main:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {/* Signed review (FR-M-001) */}
          <section aria-labelledby="review-title" className={cn("flex flex-col gap-4", PANEL)}>
            <h2 id="review-title" className="flex items-center gap-2.5 text-lg">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link">
                <ClipboardCheck className="size-[1.1rem]" aria-hidden />
              </span>
              {t("decide.review")}
            </h2>
            {signedReview ? (
              <SignedReview review={signedReview} locale={locale} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("decide.noReview")}</p>
            )}
          </section>

          <section aria-labelledby="elig-title" className={cn("flex flex-col gap-4", PANEL)}>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link">
                <ScanSearch className="size-[1.1rem]" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col">
                <h2 id="elig-title" className="text-lg">
                  {t("review.eligibility")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("review.computedOutcome", {
                    outcome: t(`review.eligibilityOutcomes.${computed.eligibilityOutcome}`),
                  })}
                </p>
              </div>
            </div>
            <RuleRows rules={computed.eligibility.rules} locale={locale} showPasses={false} />
            {blocking === 0 && (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Mark state="done" /> {t("decide.allRulesPass")}
              </p>
            )}
          </section>

          <details className={cn(PANEL, "group p-0 sm:p-0")}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[1.75rem] p-5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:p-6 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2.5 text-lg font-semibold">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link">
                  <ScrollText className="size-[1.1rem]" aria-hidden />
                </span>
                {t("decide.application")}
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
          className={cn("flex flex-col gap-5 @3xl/main:sticky @3xl/main:top-20", PANEL)}
        >
          <h2 id="decision-title" className="flex items-center gap-2.5 text-lg">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link">
              <Gavel className="size-[1.1rem]" aria-hidden />
            </span>
            {t("decide.title")}
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
                {decision.correctsId && (
                  <>
                    <dt className="text-muted-foreground">{t("decide.record.corrects")}</dt>
                    <dd data-testid="decision-corrects">
                      <span className="font-mono">{corrected?.letterNo ?? "—"}</span>
                      {decision.correctionReason && (
                        <span className="block text-xs text-muted-foreground">
                          {decision.correctionReason}
                        </span>
                      )}
                    </dd>
                  </>
                )}
                {(decision.decision === "APPROVED" ||
                  decision.decision === "APPROVED_WITH_CONDITIONS") && (
                  <>
                    <dt className="text-muted-foreground">{t("decide.record.arrangement")}</dt>
                    <dd data-testid="decision-arrangement-record">
                      {arrangementLabel(arrangement)}
                      {decision.practiceArrangement && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {t("decide.record.overridden")}
                        </span>
                      )}
                    </dd>
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
                                c.evidenceRequired ? t("decide.record.evidenceRequired") : null,
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
                    className="flex flex-col gap-3 rounded-2xl bg-[linear-gradient(145deg,var(--primary-soft),color-mix(in_oklch,var(--primary)_10%,var(--card)))] p-4 ring-1 ring-primary/20"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Award className="size-5 text-link" aria-hidden />
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

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="self-start">
                  <a href={`/api/files/letter/${decision.id}`} target="_blank" rel="noreferrer">
                    <FileDown /> {t("decide.record.letter")}
                  </a>
                </Button>
                {!block && (
                  <CorrectDecisionDialog
                    decisionId={decision.id}
                    letterNo={decision.letterNo}
                    reasons={decision.reasons}
                  />
                )}
              </div>

              {/* FR-M-017: earlier records stay as they were, superseded by their correction. */}
              {app.decisions.length > 1 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t("decide.record.earlier")}
                  </h3>
                  <ul className={LIST_GROUP} data-testid="decision-history">
                    {app.decisions.slice(1).map((d) => (
                      <li
                        key={d.id}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-2",
                          LIST_ROW,
                        )}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="font-mono text-sm font-semibold">{d.letterNo}</span>
                          <span className="text-xs text-muted-foreground">
                            {t(`decision.types.${d.decision}`)} · {d.approver.fullName} ·{" "}
                            {formatDateTime(d.signedAt, locale)}
                          </span>
                        </span>
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/api/files/letter/${d.id}`} target="_blank" rel="noreferrer">
                            <FileDown /> {t("decide.record.letterShort")}
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : pending ? (
            <>
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Signature className="size-4 text-link" aria-hidden /> {t("decide.form.intro")}
              </p>
              <DecisionForm
                applicationId={app.id}
                districts={districts.map((d) => ({ code: d.code, name: d.name }))}
                defaultScope={defaultScope}
                derivedArrangement={derivedArrangement(app)}
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
