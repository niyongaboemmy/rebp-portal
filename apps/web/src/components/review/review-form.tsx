"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PenLine,
  DocumentCheck,
  Signature,
  Sparkles,
  Wand2,
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
  signReviewSchema,
  VERIFICATION_ITEMS,
  VERIFICATION_OUTCOMES,
  type EligibilityOutcome,
  type ReviewDraft,
  type RuleOutcome,
  type StatusTone,
  type VerificationItem,
  type VerificationOutcome,
} from "@rebp/contracts";
import { TONE_ICONS, TONE_TEXT } from "@/components/data/tones";
import { OUTCOME_TONES } from "@/components/eligibility/rule-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { Input, inputClass } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { saveReviewAction, signReviewAction } from "@/server/actions/backoffice";
import { DOCUMENT_STATUS_TONES } from "./document-viewer";

export type DraftFields = Omit<ReviewDraft, "applicationId">;
type Documentation = (typeof DOCUMENTATION_OUTCOMES)[number];

export interface EvidenceView {
  suggested: VerificationOutcome;
  rules: Array<{ id: string; outcome: RuleOutcome }>;
  documents: Array<{ type: string; statuses: string[] }>;
}

const OUTCOME_TONE: Record<VerificationOutcome, StatusTone> = {
  VERIFIED: "good",
  PENDING: "info",
  FAILED: "critical",
  NA: "neutral",
};

const AUTOSAVE_MS = 1500;

/**
 * Section L administrative review (FR-L-003…010, BR-090). Six verification items with the
 * computed suggestion as a one-click default, documentation and eligibility outcomes pre-filled
 * from the engine (a reason appears only when the officer overrides), internal vs applicant-
 * visible comments, and the recommendation. Drafts autosave; signing re-authenticates and maps
 * the server's missing parts back onto the form.
 */
export function ReviewForm({
  applicationId,
  initial,
  evidence,
  computed,
  savedAt,
}: {
  applicationId: string;
  initial: DraftFields;
  evidence: Record<VerificationItem, EvidenceView>;
  computed: { documentation: Documentation; eligibility: EligibilityOutcome };
  savedAt: string | null;
}) {
  const t = useTranslations("review");
  const tv = useTranslations("validation");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<DraftFields>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">(
    savedAt ? "saved" : "idle",
  );
  const [lastSaved, setLastSaved] = useState<Date | null>(savedAt ? new Date(savedAt) : null);
  const [signing, setSigning] = useState(false);
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

  return (
    <section
      aria-labelledby="section-l-title"
      className="flex flex-col gap-6 rounded-3xl border bg-card p-5 raised sm:p-6"
      data-testid="review-form"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="section-l-title" className="text-lg">
            {t("form.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("form.subtitle")}</p>
        </div>
        <SaveState state={state} lastSaved={lastSaved} />
      </div>

      {/* L.1–L.6 verification items (FR-L-003/004) */}
      <fieldset className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <legend className="text-base font-semibold">{t("form.checks")}</legend>
          <Button type="button" variant="tonal" size="sm" onClick={applySuggestions}>
            <Wand2 /> {t("form.applySuggestions")}
          </Button>
        </div>
        <ol className="flex flex-col gap-3">
          {VERIFICATION_ITEMS.map((item) => {
            const e = evidence[item];
            const value = draft.checks[item]?.outcome;
            const error = errors[`checks.${item}`];
            const suggestedUsable = !(item === "identity" && e.suggested === "NA");
            return (
              <li
                key={item}
                id={`review-checks.${item}`}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl bg-surface-2 p-4",
                  error && "ring-2 ring-destructive/40",
                )}
              >
                <div className="flex flex-col gap-1">
                  <span className="font-semibold" id={`check-${item}-label`}>
                    {t(`items.${item}.label`)}
                  </span>
                  <span className="text-xs text-muted-foreground">{t(`items.${item}.hint`)}</span>
                </div>
                <Evidence evidence={e} />
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="group"
                    aria-labelledby={`check-${item}-label`}
                    className="flex flex-wrap gap-2"
                  >
                    {VERIFICATION_OUTCOMES.filter((o) => !(item === "identity" && o === "NA")).map(
                      (outcome) => {
                        const Icon = TONE_ICONS[OUTCOME_TONE[outcome]];
                        return (
                          <Chip
                            key={outcome}
                            selected={value === outcome}
                            onClick={() => setCheck(item, outcome)}
                            data-testid={`check-${item}-${outcome}`}
                          >
                            <Icon
                              aria-hidden
                              className={cn(value !== outcome && TONE_TEXT[OUTCOME_TONE[outcome]])}
                            />
                            {t(`outcomes.${outcome}`)}
                          </Chip>
                        );
                      },
                    )}
                  </div>
                  {suggestedUsable && value !== e.suggested && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-11 sm:h-9"
                      onClick={() => setCheck(item, e.suggested)}
                    >
                      <Sparkles />{" "}
                      {t("form.useSuggestion", { outcome: t(`outcomes.${e.suggested}`) })}
                    </Button>
                  )}
                  {suggestedUsable && value === e.suggested && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Sparkles className="size-3.5" aria-hidden /> {t("form.matchesSuggestion")}
                    </span>
                  )}
                </div>
                <label className="sr-only" htmlFor={`check-${item}-note`}>
                  {t("form.note", { item: t(`items.${item}.label`) })}
                </label>
                <Input
                  id={`check-${item}-note`}
                  value={draft.checks[item]?.note ?? ""}
                  maxLength={500}
                  placeholder={t("form.notePlaceholder")}
                  disabled={!value}
                  onChange={(ev) => value && setCheck(item, value, ev.target.value)}
                  className="bg-card dark:bg-transparent"
                />
                <ErrorText error={error} />
              </li>
            );
          })}
        </ol>
      </fieldset>

      {/* L.10 documentation and L.11 eligibility (BR-090) */}
      <div className="grid gap-4 @3xl/main:grid-cols-2">
        <OutcomePicker
          id="documentation"
          legend={t("form.documentation")}
          options={DOCUMENTATION_OUTCOMES}
          labelOf={(o) => t(`documentationOutcomes.${o}`)}
          computedValue={computed.documentation}
          value={draft.documentation}
          onChange={(documentation) =>
            update({ documentation }, ["documentation", "documentationOverrideReason"])
          }
          error={errors.documentation}
          overridden={docOverridden}
          reason={draft.documentationOverrideReason ?? ""}
          reasonError={errors.documentationOverrideReason}
          onReason={(documentationOverrideReason) =>
            update({ documentationOverrideReason }, ["documentationOverrideReason"])
          }
        />
        <OutcomePicker
          id="eligibility"
          legend={t("form.eligibility")}
          options={ELIGIBILITY_OUTCOMES}
          labelOf={(o) => t(`eligibilityOutcomes.${o}`)}
          computedValue={computed.eligibility}
          value={draft.eligibility}
          onChange={(eligibility) =>
            update({ eligibility }, ["eligibility", "eligibilityOverrideReason"])
          }
          error={errors.eligibility}
          overridden={eligOverridden}
          reason={draft.eligibilityOverrideReason ?? ""}
          reasonError={errors.eligibilityOverrideReason}
          onReason={(eligibilityOverrideReason) =>
            update({ eligibilityOverrideReason }, ["eligibilityOverrideReason"])
          }
        />
      </div>

      {/* Comments (FR-L-008) */}
      <div className="grid gap-4 @3xl/main:grid-cols-2">
        <Field label={t("form.internalComment")} description={t("form.internalHint")}>
          <FieldControl>
            <textarea
              rows={4}
              maxLength={2000}
              value={draft.internalComment ?? ""}
              onChange={(e) => update({ internalComment: e.target.value }, ["internalComment"])}
              className={cn(inputClass, "h-auto py-3")}
            />
          </FieldControl>
        </Field>
        <Field label={t("form.applicantComment")} description={t("form.applicantHint")}>
          <FieldControl>
            <textarea
              rows={4}
              maxLength={2000}
              value={draft.applicantComment ?? ""}
              onChange={(e) => update({ applicantComment: e.target.value }, ["applicantComment"])}
              className={cn(inputClass, "h-auto py-3")}
            />
          </FieldControl>
        </Field>
      </div>

      {/* Recommendation (FR-L-009, FR-L-012) */}
      <fieldset id="review-recommendation" className="flex flex-col gap-3">
        <legend className="mb-3 text-base font-semibold">{t("form.recommendation")}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {RECOMMENDATIONS.map((value) => {
            const selected = draft.recommendation === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  update({ recommendation: value }, [
                    "recommendation",
                    "reasons",
                    "reasonCodes",
                    "legalReference",
                  ])
                }
                data-testid={`recommend-${value}`}
                className={cn(
                  "flex flex-col gap-1 rounded-2xl border p-4 text-left transition-[background-color,border-color,transform] duration-(--dur-2) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.98]",
                  selected ? "border-primary bg-primary/[0.06]" : "bg-card hover:bg-surface-2",
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  {selected && <CheckCircle2 className="size-4 text-link" aria-hidden />}
                  {t(`recommendations.${value}.label`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`recommendations.${value}.hint`)}
                </span>
              </button>
            );
          })}
        </div>
        <ErrorText error={errors.recommendation} />
      </fieldset>

      {rejecting && (
        <fieldset id="review-reasonCodes" className="flex animate-rise flex-col gap-3">
          <legend className="mb-3 text-sm font-semibold">{t("form.reasonCodes")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REJECTION_REASON_CODES.map((code) => {
              const checked = draft.reasonCodes?.includes(code) ?? false;
              return (
                <label
                  key={code}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      update(
                        {
                          reasonCodes: next
                            ? [...(draft.reasonCodes ?? []), code]
                            : (draft.reasonCodes ?? []).filter((c) => c !== code),
                        },
                        ["reasonCodes"],
                      )
                    }
                  />
                  {t(`reasonCodes.${code}`)}
                </label>
              );
            })}
          </div>
          <ErrorText error={errors.reasonCodes} />
        </fieldset>
      )}

      {needsReasons && (
        <div className="grid animate-rise gap-4 @3xl/main:grid-cols-[2fr_1fr]">
          <Field
            id="review-reasons"
            label={rejecting ? t("form.reasonsReject") : t("form.reasonsRefer")}
            error={errors.reasons}
            description={t("form.reasonsHint")}
          >
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
              description={t("form.legalReferenceHint")}
            >
              <FieldControl>
                <Input
                  value={draft.legalReference ?? ""}
                  maxLength={200}
                  onChange={(e) => update({ legalReference: e.target.value }, ["legalReference"])}
                />
              </FieldControl>
            </Field>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          loading={saving || state === "saving"}
          onClick={() =>
            startSaving(async () => {
              const result = await save();
              if (result.ok) toast.success(t("form.saved"));
            })
          }
        >
          <DocumentCheck /> {t("form.save")}
        </Button>
        <Button type="button" onClick={() => setSigning(true)} data-testid="sign-review">
          <Signature /> {t("form.sign")}
        </Button>
      </div>

      <SignDialog
        open={signing}
        onOpenChange={setSigning}
        applicationId={applicationId}
        beforeSign={save}
        onReviewErrors={(fieldErrors) => {
          setErrors(fieldErrors);
          setSigning(false);
          toast.error(tv("fixFields", { count: Object.keys(fieldErrors).length }));
          const first = Object.keys(fieldErrors)[0];
          if (first)
            window.requestAnimationFrame(() =>
              document
                .getElementById(`review-${first}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" }),
            );
        }}
        onSigned={() => {
          setSigning(false);
          toast.success(t("form.signed"));
          router.refresh();
        }}
      />
    </section>
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
      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground"
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
          <CheckCircle2 className="size-3.5 text-success" aria-hidden />{" "}
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
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("form.evidence")}>
      {evidence.rules.map((rule) => {
        const tone = OUTCOME_TONES[rule.outcome];
        const Icon = TONE_ICONS[tone];
        return (
          <li
            key={`${rule.id}-${rule.outcome}`}
            className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-medium"
          >
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
          <li
            key={doc.type}
            className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-medium"
          >
            <Icon className={cn("size-3.5", TONE_TEXT[tone])} aria-hidden />
            {t.has(`docTypes.${doc.type}`) ? t(`docTypes.${doc.type}`) : doc.type}
            <span className="sr-only">: {t(`docStatus.${status}`)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function OutcomePicker<T extends string>({
  id,
  legend,
  options,
  labelOf,
  computedValue,
  value,
  onChange,
  error,
  overridden,
  reason,
  reasonError,
  onReason,
}: {
  id: string;
  legend: string;
  options: readonly T[];
  labelOf: (value: T) => string;
  computedValue: T;
  value: T | undefined;
  onChange: (value: T) => void;
  error?: string;
  overridden: boolean;
  reason: string;
  reasonError?: string;
  onReason: (value: string) => void;
}) {
  const t = useTranslations("review.form");
  return (
    <fieldset id={`review-${id}`} className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-col gap-0.5" aria-hidden>
        <span className="font-semibold">{legend}</span>
        <span className="text-xs text-muted-foreground">
          {t("computed", { value: labelOf(computedValue) })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip key={option} selected={value === option} onClick={() => onChange(option)}>
            {labelOf(option)}
            {option === computedValue && <Sparkles aria-label={t("computedMark")} />}
          </Chip>
        ))}
      </div>
      <ErrorText error={error} />
      {overridden && (
        <Field
          id={`review-${id}OverrideReason`}
          label={t("overrideReason")}
          description={t("overrideHint")}
          error={reasonError}
          className="animate-rise"
        >
          <FieldControl>
            <textarea
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(e) => onReason(e.target.value)}
              className={cn(inputClass, "h-auto bg-card py-3 dark:bg-transparent")}
            />
          </FieldControl>
        </Field>
      )}
    </fieldset>
  );
}

function SignDialog({
  open,
  onOpenChange,
  applicationId,
  beforeSign,
  onReviewErrors,
  onSigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  beforeSign: () => Promise<{ ok: boolean }>;
  onReviewErrors: (errors: Record<string, string>) => void;
  onSigned: () => void;
}) {
  const t = useTranslations("review.sign");
  const { form, submit, pending } = useActionForm({
    schema: signReviewSchema,
    defaultValues: { applicationId, password: "" },
    action: async (values) => {
      const saved = await beforeSign();
      if (!saved.ok) return { ok: false as const, error: "errors.unexpected" };
      return signReviewAction(values);
    },
    onSuccess: () => {
      form.reset({ applicationId, password: "" });
      onSigned();
    },
    onError: (result) => {
      const review = Object.fromEntries(
        Object.entries(result.fieldErrors ?? {}).filter(([key]) => key !== "password"),
      );
      if (Object.keys(review).length === 0) return false;
      form.clearErrors();
      onReviewErrors(review);
      return true;
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Field label={t("password")} error={form.formState.errors.password?.message}>
            <FieldControl>
              <PasswordInput
                autoComplete="current-password"
                autoFocus
                {...form.register("password")}
              />
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button type="submit" loading={pending} data-testid="confirm-sign-review">
              <Signature /> {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
