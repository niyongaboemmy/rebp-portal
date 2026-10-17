"use client";

import {
  Plus,
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  PenLine,
  DocumentCheck,
  ScanSearch,
  Signature,
  Sparkles,
  Wand2,
  XCircle,
  type LucideIcon,
  Eye,
  Lock,
  MessageSquare,
  Scale,
} from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DOCUMENTATION_OUTCOMES,
  ELIGIBILITY_OUTCOMES,
  RECOMMENDATIONS,
  REJECTION_REASON_CODES,
  VERIFICATION_ITEMS,
  VERIFICATION_OUTCOMES,
  type DocumentType,
  type EligibilityOutcome,
  type ReviewDraft,
  type RuleOutcome,
  type SectionKey,
  type StatusTone,
  type VerificationItem,
  type VerificationOutcome,
} from "@rebp/contracts";
import { ProgressRing } from "@/components/data/progress-ring";
import { TONE_ICONS, TONE_TEXT } from "@/components/data/tones";
import { OUTCOME_TONES } from "@/components/eligibility/rule-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { InfoTip } from "@/components/ui/info-tip";
import { Input, inputClass } from "@/components/ui/input";
import { HOVER, PANEL } from "@/components/ui/surface";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { saveReviewAction, signReviewAction } from "@/server/actions/backoffice";
import { DOCUMENT_STATUS_TONES } from "./document-viewer";
import { ChoicePill, LIST_GROUP, LIST_ROW, Mark } from "./marks";
import { ConfirmSignDialog } from "./confirm-sign-dialog";
import { RequestInfoDialog } from "./review-actions";

export type DraftFields = Omit<ReviewDraft, "applicationId">;
type Documentation = (typeof DOCUMENTATION_OUTCOMES)[number];
type Recommendation = (typeof RECOMMENDATIONS)[number];

export interface EvidenceView {
  suggested: VerificationOutcome;
  rules: Array<{ id: string; outcome: RuleOutcome }>;
  documents: Array<{ type: string; statuses: string[] }>;
}

/** The status groups of the verification checks, in the order they're shown (UX-036). */
const CHECK_GROUPS = ["todo", "failed", "done"] as const;
/** The review's four parts and where each lives on the page (the footer's steps, UX-036). */
const PARTS = [
  ["checks", "review-checks"],
  ["documentation", "review-documentation"],
  ["eligibility", "review-eligibility"],
  ["recommendation", "review-recommendation"],
] as const;
const groupOf = (outcome: VerificationOutcome | undefined): (typeof CHECK_GROUPS)[number] =>
  !outcome || outcome === "PENDING" ? "todo" : outcome === "FAILED" ? "failed" : "done";

const OUTCOME_TONE: Record<VerificationOutcome, StatusTone> = {
  VERIFIED: "good",
  PENDING: "info",
  FAILED: "critical",
  NA: "neutral",
};

const RECOMMENDATION_ICONS: Record<Recommendation, LucideIcon> = {
  APPROVE: Check,
  REFER: ScanSearch,
  REJECT: XCircle,
};

const AUTOSAVE_MS = 1500;
const MIN_REASON = 10;

/** Fields ready to sign, in the order the officer meets them (the progress summary). */
function progressOf(
  draft: DraftFields,
  computed: { documentation: Documentation; eligibility: EligibilityOutcome },
) {
  const checks = VERIFICATION_ITEMS.filter((item) => draft.checks[item]?.outcome).length;
  const reasoned = (overridden: boolean, reason?: string) =>
    !overridden || (reason?.trim().length ?? 0) >= MIN_REASON;
  const documentation =
    Boolean(draft.documentation) &&
    reasoned(draft.documentation !== computed.documentation, draft.documentationOverrideReason);
  const eligibility =
    Boolean(draft.eligibility) &&
    reasoned(draft.eligibility !== computed.eligibility, draft.eligibilityOverrideReason);
  const rec = draft.recommendation;
  const recommendation =
    Boolean(rec) &&
    (rec === "APPROVE" || (draft.reasons?.trim().length ?? 0) >= MIN_REASON) &&
    (rec !== "REJECT" || (draft.reasonCodes?.length ?? 0) > 0);
  const parts =
    (checks === VERIFICATION_ITEMS.length ? 1 : 0) +
    (documentation ? 1 : 0) +
    (eligibility ? 1 : 0) +
    (recommendation ? 1 : 0);
  return { checks, documentation, eligibility, recommendation, parts };
}

/**
 * Section L administrative review (FR-L-003…010, BR-090). Six verification items as calm rows
 * with the computed suggestion as a one-click default, documentation and eligibility outcomes
 * pre-filled from the engine (a reason appears only when the officer overrides), internal vs
 * applicant-visible comments, and the recommendation as choice cards. A live progress summary
 * sits on top; Save draft / Request information / Sign review ride in a sticky footer. Drafts
 * autosave; signing re-authenticates and maps the server's missing parts back onto the form.
 */
export function ReviewForm({
  applicationId,
  initial,
  evidence,
  computed,
  savedAt,
  requestInfo,
}: {
  applicationId: string;
  initial: DraftFields;
  evidence: Record<VerificationItem, EvidenceView>;
  computed: { documentation: Documentation; eligibility: EligibilityOutcome };
  savedAt: string | null;
  /** FR-L-007: the information request, offered from the footer while the review is open. */
  requestInfo?: { sections: readonly SectionKey[]; documents: readonly DocumentType[] };
}) {
  const t = useTranslations("review");
  const tv = useTranslations("validation");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<DraftFields>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Notes stay out of the way until asked for ("+ note"), or a check fails (UX-036).
  const [notesOpen, setNotesOpen] = useState<Set<VerificationItem>>(new Set());
  const [state, setState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">(
    savedAt ? "saved" : "idle",
  );
  const [lastSaved, setLastSaved] = useState<Date | null>(savedAt ? new Date(savedAt) : null);
  const [signing, setSigning] = useState(false);
  // Long answers live in modals (UX-036): the page keeps a one-line summary of each.
  const [modal, setModal] = useState<Modal | null>(null);
  const [saving, startSaving] = useTransition();
  const timer = useRef<number | undefined>(undefined);
  // The latest draft for autosave; written in event handlers, read when saving.
  const latest = useRef(initial);

  const save = useCallback(async () => {
    window.clearTimeout(timer.current);
    setState("saving");
    const result = await saveReviewAction({ applicationId, ...latest.current });
    if (result.ok) {
      setState("saved");
      setLastSaved(new Date());
    } else {
      setState("error");
      toast.error(errorMessage(result.error));
    }
    return result;
  }, [applicationId, errorMessage]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const update = (patch: Partial<DraftFields>, fields: string[]) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    if (fields.some((f) => errors[f]))
      setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !fields.includes(k))));
    setState("dirty");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), AUTOSAVE_MS);
  };

  // After an answer, glide to the next check still to answer (UX-036).
  const answerCheck = (item: VerificationItem, outcome: VerificationOutcome) => {
    setCheck(item, outcome);
    if (outcome === "PENDING") return;
    const after = VERIFICATION_ITEMS.find(
      (i) =>
        i !== item &&
        (!latest.current.checks[i]?.outcome || latest.current.checks[i]?.outcome === "PENDING"),
    );
    if (after)
      window.setTimeout(
        () =>
          document
            .getElementById(`review-checks.${after}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        150,
      );
  };

  const setCheck = (item: VerificationItem, outcome: VerificationOutcome, note?: string) =>
    update(
      {
        checks: {
          ...latest.current.checks,
          [item]: { outcome, note: note ?? latest.current.checks[item]?.note },
        },
      },
      [`checks.${item}`],
    );

  const applySuggestions = () => {
    const checks = { ...latest.current.checks };
    for (const item of VERIFICATION_ITEMS) {
      if (checks[item]?.outcome) continue;
      const suggested = evidence[item].suggested;
      if (item === "identity" && suggested === "NA") continue;
      checks[item] = { outcome: suggested, note: checks[item]?.note };
    }
    update(
      { checks },
      VERIFICATION_ITEMS.map((i) => `checks.${i}`),
    );
  };

  const docOverridden = Boolean(
    draft.documentation && draft.documentation !== computed.documentation,
  );
  const eligOverridden = Boolean(draft.eligibility && draft.eligibility !== computed.eligibility);
  const rejecting = draft.recommendation === "REJECT";
  const needsReasons = rejecting || draft.recommendation === "REFER";
  const progress = progressOf(draft, computed);
  const reasonsReady =
    (draft.reasons?.trim().length ?? 0) >= MIN_REASON &&
    (!rejecting || (draft.reasonCodes?.length ?? 0) > 0);
  const total = VERIFICATION_ITEMS.length;
  const unfilled = VERIFICATION_ITEMS.some((item) => !draft.checks[item]?.outcome);
  // The check to do next: the first one with no answer, or still "Pending".
  const needsAnswer = (item: VerificationItem) =>
    !draft.checks[item]?.outcome || draft.checks[item]?.outcome === "PENDING";
  const nextCheck = VERIFICATION_ITEMS.find(needsAnswer);
  const nextPart = PARTS.map(([part]) => part).find((part) =>
    part === "checks" ? progress.checks !== total : !progress[part],
  );

  return (
    <section
      id="review-form"
      aria-labelledby="section-l-title"
      className={cn("flex scroll-mt-28 flex-col gap-6 pb-20", PANEL)}
      data-testid="review-form"
    >
      {/* The title and autosave; progress lives on the checks ring and the floating steps. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="section-l-title" className="text-lg">
          {t("form.title")}
        </h2>
        <SaveState state={state} lastSaved={lastSaved} />
      </div>

      {/* L.1–L.6 verification items (FR-L-003/004) */}
      <fieldset id="review-checks" className="flex scroll-mt-32 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-3">
            {/* How many checks are recorded, as a ring (UX-036) — the same count as the footer step. */}
            <ProgressRing
              value={progress.checks}
              total={total}
              thickness={4}
              className="size-11"
              label={t("form.progress.checks", { done: progress.checks, total })}
            >
              <span className="text-[0.65rem] font-bold num">
                {progress.checks}/{total}
              </span>
            </ProgressRing>
            <legend className="text-base font-semibold">{t("form.checks")}</legend>
          </span>
          {unfilled && (
            <Button type="button" variant="tonal" size="sm" onClick={applySuggestions}>
              <Wand2 /> {t("form.applySuggestions")}
            </Button>
          )}
        </div>
        {/* One line saying what to do now. */}
        <p className="inline-flex items-center gap-2 text-sm">
          {nextCheck ? (
            <>
              <span aria-hidden className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-sun" />
                <span className="relative size-2 rounded-full bg-sun" />
              </span>
              <span className="font-semibold">
                {t("form.nextCheckLine", {
                  n: VERIFICATION_ITEMS.indexOf(nextCheck) + 1,
                  label: t(`items.${nextCheck}.label`),
                })}
              </span>
            </>
          ) : (
            <>
              <Check className="size-4 text-link" aria-hidden />
              <span className="font-semibold">{t("form.allChecksDone")}</span>
            </>
          )}
        </p>
        {/* Grouped by status (UX-036): what's left to do first, then any failed, then done. A
            row moves to its group as it's answered. */}
        {CHECK_GROUPS.map((group) => {
          const items = VERIFICATION_ITEMS.filter(
            (item) => groupOf(draft.checks[item]?.outcome) === group,
          );
          if (items.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-2">
              <h3
                className={cn(
                  "inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase",
                  group === "todo"
                    ? "text-foreground"
                    : group === "failed"
                      ? "text-destructive"
                      : "text-link",
                )}
              >
                {group === "todo" ? (
                  <span aria-hidden className="relative flex size-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-sun" />
                    <span className="relative size-2 rounded-full bg-sun" />
                  </span>
                ) : group === "failed" ? (
                  <span aria-hidden className="size-2 rounded-full bg-destructive" />
                ) : (
                  <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                )}
                {t(`form.groups.${group}`)}
                <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[0.65rem] num dark:bg-white/[0.08]">
                  {items.length}
                </span>
              </h3>
              <ol className={LIST_GROUP}>
                {items.map((item) => {
                  const n = VERIFICATION_ITEMS.indexOf(item);
                  const e = evidence[item];
                  const value = draft.checks[item]?.outcome;
                  const error = errors[`checks.${item}`];
                  const suggestedUsable = !(item === "identity" && e.suggested === "NA");
                  const isNext = item === nextCheck;
                  const answered = Boolean(value) && value !== "PENDING";
                  const note = draft.checks[item]?.note ?? "";
                  const showNote = value === "FAILED" || note.length > 0 || notesOpen.has(item);
                  return (
                    <li
                      key={item}
                      id={`review-checks.${item}`}
                      className={cn(
                        // Compact (UX-036): title and evidence on the left, the outcome on the right.
                        "flex animate-in scroll-mt-32 flex-col gap-2.5 py-3 duration-300 fade-in slide-in-from-bottom-2 @3xl/main:grid @3xl/main:grid-cols-[minmax(0,1fr)_auto] @3xl/main:items-center @3xl/main:gap-6",
                        LIST_ROW,
                        isNext && "bg-sun/[0.07] hover:bg-sun/[0.07] dark:bg-sun/[0.06]",
                        error && "bg-danger-soft/50 hover:bg-danger-soft/50",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <StepBadge
                          n={n + 1}
                          state={
                            value === "FAILED"
                              ? "failed"
                              : answered
                                ? "done"
                                : isNext
                                  ? "next"
                                  : "todo"
                          }
                        />
                        <div className="flex min-w-0 flex-col gap-1">
                          <span
                            className="inline-flex items-center gap-1.5 font-semibold"
                            id={`check-${item}-label`}
                          >
                            {t(`items.${item}.label`)}
                            <InfoTip label={t(`items.${item}.label`)}>
                              {t(`items.${item}.hint`)}
                            </InfoTip>
                            {isNext && (
                              <span className="inline-flex items-center rounded-full bg-sun px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-sun-foreground uppercase">
                                {t("form.nextCheck")}
                              </span>
                            )}
                          </span>
                          <Evidence evidence={e} />
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2 pl-10 @3xl/main:items-end @3xl/main:pl-0">
                        <div
                          role="group"
                          aria-labelledby={`check-${item}-label`}
                          className="flex flex-wrap items-center gap-1.5 @3xl/main:justify-end"
                        >
                          {VERIFICATION_OUTCOMES.filter(
                            (o) => !(item === "identity" && o === "NA"),
                          ).map((outcome) => {
                            const Icon = TONE_ICONS[OUTCOME_TONE[outcome]];
                            const suggested = suggestedUsable && outcome === e.suggested;
                            return (
                              <ChoicePill
                                key={outcome}
                                selected={value === outcome}
                                onClick={() => answerCheck(item, outcome)}
                                data-testid={`check-${item}-${outcome}`}
                                title={suggested ? t("form.suggested") : undefined}
                              >
                                <Icon aria-hidden className={TONE_TEXT[OUTCOME_TONE[outcome]]} />
                                {t(`outcomes.${outcome}`)}
                                {/* The engine's suggestion: a small sparkle on that option. */}
                                {suggested && (
                                  <>
                                    <Sparkles aria-hidden className="size-3 text-link" />
                                    <span className="sr-only">({t("form.suggested")})</span>
                                  </>
                                )}
                              </ChoicePill>
                            );
                          })}
                          {!showNote && value && (
                            <button
                              type="button"
                              onClick={() => setNotesOpen((o) => new Set(o).add(item))}
                              className="rounded-full px-2.5 py-1 text-xs font-semibold text-link hover:bg-primary-soft"
                            >
                              + {t("form.addNote")}
                            </button>
                          )}
                        </div>
                        {showNote && (
                          <>
                            <label className="sr-only" htmlFor={`check-${item}-note`}>
                              {t("form.note", { item: t(`items.${item}.label`) })}
                            </label>
                            <Input
                              id={`check-${item}-note`}
                              value={note}
                              maxLength={500}
                              placeholder={t("form.notePlaceholder")}
                              disabled={!value}
                              autoFocus={notesOpen.has(item) && !note}
                              onChange={(ev) => value && setCheck(item, value, ev.target.value)}
                              className="h-9 w-full bg-card @3xl/main:w-96 dark:bg-transparent"
                            />
                          </>
                        )}
                        <ErrorText error={error} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </fieldset>

      {/* The three outcomes side by side, as equal cards (UX-036): L.10 documentation and L.11
          eligibility (BR-090; the sparkle marks the computed one) and the recommendation. */}
      <div className="grid items-stretch gap-3 @3xl/main:grid-cols-3">
        <OutcomeCard
          id="documentation"
          legend={t("form.documentation")}
          options={DOCUMENTATION_OUTCOMES}
          labelOf={(o) => t(`documentationOutcomes.${o}`)}
          suggested={computed.documentation}
          value={draft.documentation}
          done={progress.documentation}
          onChange={(documentation) => {
            update({ documentation }, ["documentation", "documentationOverrideReason"]);
            if (documentation !== computed.documentation && !draft.documentationOverrideReason)
              setModal("documentationOverrideReason");
          }}
          error={errors.documentation}
        />
        <OutcomeCard
          id="eligibility"
          legend={t("form.eligibility")}
          options={ELIGIBILITY_OUTCOMES}
          labelOf={(o) => t(`eligibilityOutcomes.${o}`)}
          suggested={computed.eligibility}
          value={draft.eligibility}
          done={progress.eligibility}
          onChange={(eligibility) => {
            update({ eligibility }, ["eligibility", "eligibilityOverrideReason"]);
            if (eligibility !== computed.eligibility && !draft.eligibilityOverrideReason)
              setModal("eligibilityOverrideReason");
          }}
          error={errors.eligibility}
        />
        {/* Recommendation (FR-L-009, FR-L-012): Reject or Refer opens the reasons modal. */}
        <OutcomeCard
          id="recommendation"
          legend={t("form.recommendation")}
          options={RECOMMENDATIONS}
          labelOf={(o) => t(`recommendations.${o}.label`)}
          titleOf={(o) => t(`recommendations.${o}.hint`)}
          iconOf={(o) => RECOMMENDATION_ICONS[o]}
          testIdOf={(o) => `recommend-${o}`}
          value={draft.recommendation}
          done={progress.recommendation}
          onChange={(recommendation) => {
            const was = draft.recommendation;
            update({ recommendation }, [
              "recommendation",
              "reasons",
              "reasonCodes",
              "legalReference",
            ]);
            if (recommendation !== "APPROVE" && recommendation !== was) setModal("reasons");
          }}
          error={errors.recommendation}
        />
      </div>

      {/* Everything written, summarised in one aligned grid of equal rows (UX-036); each opens
          its modal. Override reasons and the recommendation's reasons appear when needed. */}
      <div className="grid gap-2.5 @3xl/main:grid-cols-2 @5xl/main:grid-cols-3">
        {docOverridden && (
          <SummaryRow
            id="review-documentationOverrideReason"
            icon={PenLine}
            label={t("form.overrideOf", { part: t("form.documentation") })}
            preview={draft.documentationOverrideReason || t("form.overrideNeeded")}
            state={
              (draft.documentationOverrideReason?.trim().length ?? 0) >= MIN_REASON
                ? "done"
                : "todo"
            }
            error={errors.documentationOverrideReason}
            onClick={() => setModal("documentationOverrideReason")}
            className="animate-rise"
          />
        )}
        {eligOverridden && (
          <SummaryRow
            id="review-eligibilityOverrideReason"
            icon={PenLine}
            label={t("form.overrideOf", { part: t("form.eligibility") })}
            preview={draft.eligibilityOverrideReason || t("form.overrideNeeded")}
            state={
              (draft.eligibilityOverrideReason?.trim().length ?? 0) >= MIN_REASON ? "done" : "todo"
            }
            error={errors.eligibilityOverrideReason}
            onClick={() => setModal("eligibilityOverrideReason")}
            className="animate-rise"
          />
        )}
        {needsReasons && (
          <SummaryRow
            id="review-reasons-summary"
            icon={Scale}
            label={rejecting ? t("form.reasonsReject") : t("form.reasonsRefer")}
            preview={
              reasonsReady
                ? [
                    ...(rejecting
                      ? (draft.reasonCodes ?? []).map((c) => t(`reasonCodes.${c}`))
                      : []),
                    draft.reasons,
                  ].join(" · ")
                : t("form.reasonsNeeded")
            }
            state={reasonsReady ? "done" : "todo"}
            error={errors.reasons ?? errors.reasonCodes ?? errors.legalReference}
            onClick={() => setModal("reasons")}
            className="animate-rise"
          />
        )}
        {/* Comments (FR-L-008): optional. */}
        <SummaryRow
          id="review-internalComment"
          icon={Lock}
          label={t("form.internalComment")}
          preview={draft.internalComment || t("form.internalHint")}
          state={draft.internalComment ? "done" : "optional"}
          onClick={() => setModal("internalComment")}
        />
        <SummaryRow
          id="review-applicantComment"
          icon={MessageSquare}
          label={t("form.applicantComment")}
          preview={draft.applicantComment || t("form.applicantHint")}
          state={draft.applicantComment ? "done" : "optional"}
          onClick={() => setModal("applicantComment")}
        />
      </div>

      {/* The form's actions float at the bottom right while it's open (UX-036): progress, Save,
          Request information and Sign — always in reach, wherever the officer has scrolled. */}
      <footer className="fixed right-4 bottom-[calc(var(--bottom-nav-h,0px)+1rem)] z-30 flex max-w-[calc(100vw-2rem)] animate-in items-center gap-2 rounded-full bg-card/90 p-1.5 ring-1 ring-primary/15 backdrop-blur-xl duration-300 fade-in slide-in-from-bottom-6 sm:right-6 sm:bottom-6 dark:bg-[oklch(0.22_0.02_265/0.92)] dark:ring-white/[0.08]">
        {/* Where to go next (UX-036): the four parts as steps — ticked when done; the next one
            pulses and takes you there. When all four are done, Sign glows. */}
        <span className="flex min-w-0 items-center gap-1 pl-1">
          <ProgressRing
            value={progress.parts}
            total={4}
            thickness={4}
            className="size-9 shrink-0"
            label={t("form.progress.ready", { done: progress.parts, total: 4 })}
          >
            <span className="text-[0.65rem] font-bold num">{progress.parts}/4</span>
          </ProgressRing>
          {PARTS.map(([part, anchor]) => {
            const done = part === "checks" ? progress.checks === total : progress[part];
            const isNext = part === nextPart;
            return (
              <button
                key={part}
                type="button"
                onClick={() =>
                  document
                    .getElementById(anchor)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                title={t(`form.${part}`)}
                aria-label={`${t(`form.${part}`)}: ${done ? t("form.progress.done") : t("form.progress.todo")}`}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors duration-(--dur-2)",
                  done
                    ? "text-link hover:bg-primary-soft"
                    : isNext
                      ? "bg-sun/15 text-foreground hover:bg-sun/25"
                      : "text-muted-foreground hover:bg-foreground/[0.05]",
                )}
              >
                {done ? (
                  <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 rounded-full",
                      isNext ? "missing-mark bg-sun" : "bg-foreground/20",
                    )}
                  />
                )}
                <span className={cn(!isNext && "hidden @4xl/main:inline")}>
                  {t(`form.short.${part}`)}
                </span>
              </button>
            );
          })}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            loading={saving || state === "saving"}
            onClick={() =>
              startSaving(async () => {
                const result = await save();
                if (result.ok) toast.success(t("form.saved"));
              })
            }
            className="px-3 @xl/main:px-4"
          >
            <DocumentCheck />
            <span className="@max-xl/main:sr-only">{t("form.save")}</span>
          </Button>
          {requestInfo && (
            <RequestInfoDialog
              applicationId={applicationId}
              sections={requestInfo.sections}
              documents={requestInfo.documents}
              compact
            />
          )}
          <Button
            type="button"
            onClick={() => setSigning(true)}
            data-testid="sign-review"
            className={cn("px-4", progress.parts === 4 && "lifecycle-pulse")}
          >
            <Signature /> {t("form.sign")}
          </Button>
        </span>
      </footer>

      <TextModal
        open={modal === "internalComment" || modal === "applicantComment"}
        onOpenChange={(open) => !open && setModal(null)}
        id={modal === "applicantComment" ? "applicantComment" : "internalComment"}
        title={t(modal === "applicantComment" ? "form.applicantComment" : "form.internalComment")}
        description={t(modal === "applicantComment" ? "form.applicantHint" : "form.internalHint")}
        value={
          (modal === "applicantComment" ? draft.applicantComment : draft.internalComment) ?? ""
        }
        onChange={(value) =>
          modal === "applicantComment"
            ? update({ applicantComment: value }, ["applicantComment"])
            : update({ internalComment: value }, ["internalComment"])
        }
      />
      <TextModal
        open={modal === "documentationOverrideReason" || modal === "eligibilityOverrideReason"}
        onOpenChange={(open) => !open && setModal(null)}
        id={modal ?? "documentationOverrideReason"}
        title={t("form.overrideReason")}
        description={t("form.overrideHint")}
        error={modal ? errors[modal] : undefined}
        value={
          (modal === "eligibilityOverrideReason"
            ? draft.eligibilityOverrideReason
            : draft.documentationOverrideReason) ?? ""
        }
        onChange={(value) =>
          modal === "eligibilityOverrideReason"
            ? update({ eligibilityOverrideReason: value }, ["eligibilityOverrideReason"])
            : update({ documentationOverrideReason: value }, ["documentationOverrideReason"])
        }
      />
      <Dialog open={modal === "reasons"} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="sm:max-w-2xl" data-testid="reasons-dialog">
          <DialogHeader>
            <DialogTitle>
              {rejecting ? t("form.reasonsReject") : t("form.reasonsRefer")}
            </DialogTitle>
            <DialogDescription>{t("form.reasonsHint")}</DialogDescription>
          </DialogHeader>
          {rejecting && (
            <fieldset id="review-reasonCodes" className="flex flex-col gap-2.5">
              <legend className="mb-2 text-sm font-semibold">{t("form.reasonCodes")}</legend>
              {/* Tap the reasons that apply (UX-036). */}
              <div className="flex flex-wrap gap-2">
                {REJECTION_REASON_CODES.map((code) => {
                  const checked = draft.reasonCodes?.includes(code) ?? false;
                  return (
                    <ChoicePill
                      key={code}
                      selected={checked}
                      aria-pressed={checked}
                      onClick={() =>
                        update(
                          {
                            reasonCodes: checked
                              ? (draft.reasonCodes ?? []).filter((c) => c !== code)
                              : [...(draft.reasonCodes ?? []), code],
                          },
                          ["reasonCodes"],
                        )
                      }
                    >
                      {checked ? <Check aria-hidden className="text-link" /> : <Plus aria-hidden />}
                      {t(`reasonCodes.${code}`)}
                    </ChoicePill>
                  );
                })}
              </div>
              <ErrorText error={errors.reasonCodes} />
            </fieldset>
          )}
          <Field id="review-reasons" label={t("form.reasons")} error={errors.reasons}>
            <FieldControl>
              <textarea
                rows={4}
                maxLength={2000}
                value={draft.reasons ?? ""}
                onChange={(e) => update({ reasons: e.target.value }, ["reasons"])}
                className={cn(inputClass, "h-auto py-3")}
              />
            </FieldControl>
          </Field>
          {rejecting && (
            <Field
              id="review-legalReference"
              label={t("form.legalReference")}
              error={errors.legalReference}
            >
              <FieldControl>
                <Input
                  value={draft.legalReference ?? ""}
                  maxLength={200}
                  placeholder={t("form.legalReferenceHint")}
                  onChange={(e) => update({ legalReference: e.target.value }, ["legalReference"])}
                />
              </FieldControl>
            </Field>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">
                <Check /> {t("form.done")}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignDialog
        open={signing}
        onOpenChange={setSigning}
        applicationId={applicationId}
        recommendation={draft.recommendation}
        beforeSign={save}
        onReviewErrors={(fieldErrors) => {
          setErrors(fieldErrors);
          setSigning(false);
          toast.error(tv("fixFields", { count: Object.keys(fieldErrors).length }));
          const first = Object.keys(fieldErrors)[0];
          const holder = first && MODAL_OF[first];
          if (holder) setModal(holder);
          else if (first)
            window.requestAnimationFrame(() =>
              document
                .getElementById(`review-${first}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" }),
            );
        }}
        onSigned={() => {
          setSigning(false);
          // "Validation completed", with the companion acting out the recommendation (UX-036).
          const url = new URL(window.location.href);
          url.searchParams.set("tab", "review");
          url.searchParams.set("celebrate", latest.current.recommendation ?? "APPROVE");
          router.replace(`${url.pathname}${url.search}` as never, { scroll: false });
          router.refresh();
        }}
      />
    </section>
  );
}

type Modal =
  | "reasons"
  | "internalComment"
  | "applicantComment"
  | "documentationOverrideReason"
  | "eligibilityOverrideReason";

/** Which modal holds a field, so a sign-time error opens it. */
const MODAL_OF: Record<string, Modal> = {
  reasons: "reasons",
  reasonCodes: "reasons",
  legalReference: "reasons",
  internalComment: "internalComment",
  applicantComment: "applicantComment",
  documentationOverrideReason: "documentationOverrideReason",
  eligibilityOverrideReason: "eligibilityOverrideReason",
};

/**
 * A long answer, summarised in one row (UX-036): icon, label, the first words, and its state —
 * a soft tick when given, a pulsing yellow dot when still needed. Tapping opens its modal.
 */
function SummaryRow({
  id,
  icon: Icon,
  label,
  preview,
  state,
  error,
  onClick,
  className,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  preview: string;
  state: "done" | "todo" | "optional";
  error?: string;
  onClick: () => void;
  className?: string;
}) {
  const t = useTranslations("review.form");
  return (
    <div className={cn("flex scroll-mt-32 flex-col gap-1.5", className)} id={id}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full items-center gap-3 rounded-2xl bg-card/60 px-3 py-2.5 text-left ring-1 ring-foreground/[0.07] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:bg-surface-2/50 dark:ring-white/[0.06]",
          HOVER,
          (state === "todo" || error) && "ring-sun/40 dark:ring-sun/30",
        )}
      >
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link"
        >
          <Icon className="size-[1.1rem]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold">{label}</span>
          <span
            className={cn(
              "truncate text-xs",
              state === "done" ? "text-foreground/80" : "text-muted-foreground",
            )}
          >
            {preview}
          </span>
        </span>
        {state === "done" ? (
          <CheckCircle2 aria-label={t("progress.done")} className="size-4 shrink-0 text-link" />
        ) : state === "todo" ? (
          <span
            role="img"
            aria-label={t("progress.todo")}
            className="missing-mark size-2 shrink-0 rounded-full bg-sun"
          />
        ) : null}
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-link group-hover:bg-primary-soft">
          {state === "done" ? t("edit") : t("add")}
        </span>
      </button>
      <ErrorText error={error} />
    </div>
  );
}

/** One long text, written in a modal; changes autosave with the rest of the draft. */
function TextModal({
  open,
  onOpenChange,
  id,
  title,
  description,
  value,
  onChange,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const t = useTranslations("review.form");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="sr-only" htmlFor={`${id}-text`}>
          {title}
        </label>
        <textarea
          id={`${id}-text`}
          rows={5}
          maxLength={2000}
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, "h-auto py-3")}
        />
        <ErrorText error={error} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">
              <Check /> {t("done")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveState({ state, lastSaved }: { state: string; lastSaved: Date | null }) {
  const t = useTranslations("review.form");
  const time = lastSaved
    ? new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "Africa/Kigali" }).format(
        lastSaved,
      )
    : null;
  return (
    <span
      className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-foreground/[0.06] dark:bg-surface-2/50 dark:ring-white/[0.06]"
      aria-live="polite"
    >
      {state === "saving" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> {t("saving")}
        </>
      ) : state === "dirty" ? (
        <>
          <PenLine className="size-3.5" aria-hidden /> {t("unsaved")}
        </>
      ) : state === "error" ? (
        <span className="inline-flex items-center gap-1.5 text-destructive">
          <AlertTriangle className="size-3.5" aria-hidden /> {t("saveFailed")}
        </span>
      ) : lastSaved ? (
        <>
          <CheckCircle2 className="size-3.5 text-link" aria-hidden />{" "}
          {t("savedAt", { time: time ?? "" })}
        </>
      ) : (
        t("notSaved")
      )}
    </span>
  );
}

function ErrorText({ error }: { error?: string }) {
  const translate = useErrorMessage();
  const message = translate(error);
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex animate-rise items-start gap-1.5 text-xs font-medium text-destructive"
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

function Evidence({ evidence }: { evidence: EvidenceView }) {
  const t = useTranslations("review");
  if (evidence.rules.length === 0 && evidence.documents.length === 0)
    return <p className="text-xs text-muted-foreground">{t("form.noEvidence")}</p>;
  const pill =
    "inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2.5 py-1 text-xs font-medium dark:bg-white/[0.06]";
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("form.evidence")}>
      {evidence.rules.map((rule) => {
        const tone = OUTCOME_TONES[rule.outcome];
        const Icon = TONE_ICONS[tone];
        return (
          <li key={`${rule.id}-${rule.outcome}`} className={pill}>
            <Icon className={cn("size-3.5", TONE_TEXT[tone])} aria-hidden />
            <span className="font-mono">{rule.id}</span>
            <span className="sr-only">{t(`ruleOutcomes.${rule.outcome}`)}</span>
          </li>
        );
      })}
      {evidence.documents.map((doc) => {
        const status = doc.statuses[0] ?? "MISSING";
        const tone =
          status === "MISSING" ? "warning" : (DOCUMENT_STATUS_TONES[status] ?? "neutral");
        const Icon = TONE_ICONS[tone];
        return (
          <li key={doc.type}>
            {/* Opens the document in the viewer, so the officer can look while judging (UX-036). */}
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("review-console:open-document", { detail: doc.type }),
                )
              }
              data-testid={`evidence-doc-${doc.type}`}
              className={cn(
                pill,
                "cursor-pointer transition-colors hover:bg-primary/[0.08] hover:text-link focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              )}
            >
              <Icon className={cn("size-3.5", TONE_TEXT[tone])} aria-hidden />
              {t.has(`docTypes.${doc.type}`) ? t(`docTypes.${doc.type}`) : doc.type}
              <Eye className="size-3 opacity-60" aria-hidden />
              <span className="sr-only">: {t(`docStatus.${status}`)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One outcome as a card (UX-036): a mark and the title, then the choices as pills. All three
 * cards share this shape so they line up in the grid; reasons are summarised below them.
 */
function OutcomeCard<T extends string>({
  id,
  legend,
  options,
  labelOf,
  titleOf,
  iconOf,
  testIdOf,
  suggested,
  value,
  done,
  onChange,
  error,
}: {
  id: string;
  legend: string;
  options: readonly T[];
  labelOf: (value: T) => string;
  titleOf?: (value: T) => string;
  iconOf?: (value: T) => LucideIcon;
  testIdOf?: (value: T) => string;
  /** The computed outcome, marked with a sparkle. */
  suggested?: T;
  value: T | undefined;
  done: boolean;
  onChange: (value: T) => void;
  error?: string;
}) {
  const t = useTranslations("review.form");
  return (
    <fieldset
      id={`review-${id}`}
      className="flex scroll-mt-32 flex-col gap-3 rounded-2xl bg-card/60 p-4 ring-1 ring-foreground/[0.07] dark:bg-surface-2/50 dark:ring-white/[0.06]"
    >
      <legend className="sr-only">{legend}</legend>
      <span className="flex items-center gap-2.5" aria-hidden>
        <Mark state={done ? "done" : "todo"} />
        <span className="font-semibold">{legend}</span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const Icon = iconOf?.(option);
          return (
            <ChoicePill
              key={option}
              selected={value === option}
              onClick={() => onChange(option)}
              title={titleOf?.(option)}
              data-testid={testIdOf?.(option)}
            >
              {Icon && <Icon aria-hidden className={cn(value === option && "text-link")} />}
              {labelOf(option)}
              {option === suggested && (
                <Sparkles className="text-link" aria-label={t("computedMark")} />
              )}
            </ChoicePill>
          );
        })}
      </div>
      <ErrorText error={error} />
    </fieldset>
  );
}

function SignDialog({
  open,
  onOpenChange,
  applicationId,
  recommendation,
  beforeSign,
  onReviewErrors,
  onSigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  recommendation?: Recommendation;
  beforeSign: () => Promise<{ ok: boolean }>;
  onReviewErrors: (errors: Record<string, string>) => void;
  onSigned: () => void;
}) {
  const t = useTranslations("review");
  const errorMessage = useErrorMessage();
  const [pending, start] = useTransition();
  // FR-L-010: a plain confirmation in the officer's two-step-verified session (UX-036).
  const confirm = () =>
    start(async () => {
      const saved = await beforeSign();
      if (!saved.ok) return;
      const result = await signReviewAction({ applicationId });
      if (result.ok) return onSigned();
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0)
        return onReviewErrors(result.fieldErrors);
      toast.error(errorMessage(result.error));
    });
  return (
    <ConfirmSignDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Signature}
      title={t("sign.title")}
      description={t("sign.description")}
      outcomeLabel={t("sign.outcome")}
      outcome={recommendation ? t(`recommendations.${recommendation}.label`) : "—"}
      danger={recommendation === "REJECT"}
      confirmLabel={t("sign.submit")}
      pending={pending}
      onConfirm={confirm}
      testId="confirm-sign-review"
    />
  );
}

/** A check's number in the guided list (UX-036): ticked when done, pulsing when it's next. */
function StepBadge({ n, state }: { n: number; state: "done" | "next" | "todo" | "failed" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold num transition-colors duration-(--dur-3)",
        state === "done" && "bg-primary-soft text-link ring-1 ring-primary/30",
        state === "next" && "lifecycle-pulse bg-primary text-primary-foreground",
        state === "failed" && "bg-danger-soft text-destructive ring-1 ring-destructive/30",
        state === "todo" && "bg-foreground/[0.06] text-muted-foreground dark:bg-white/[0.08]",
      )}
    >
      {state === "done" ? <Check className="size-3.5" strokeWidth={2.5} /> : n}
    </span>
  );
}
