"use client";

import { Select } from "@/components/ui/select";
import {
  Check,
  Gavel,
  Globe2,
  Hourglass,
  ListChecks,
  Plus,
  Signature,
  Trash2,
  XCircle,
  type LucideIcon,
} from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import {
  DECISIONS,
  decisionSchema,
  LICENCE_ARRANGEMENTS,
  REJECTION_REASON_CODES,
  STANDARD_CONDITIONS,
  type DecisionType,
  type LicenceArrangement,
} from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldControl } from "@/components/ui/field";
import { Input, inputClass } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { HOVER, INTERACTIVE, SELECTED } from "@/components/ui/surface";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { recordDecisionAction } from "@/server/actions/backoffice";
import { ConfirmSignDialog } from "./confirm-sign-dialog";
import { ChoicePill, LIST_GROUP, LIST_ROW, StepNumber } from "./marks";

const APPROVALS: readonly DecisionType[] = ["APPROVED", "APPROVED_WITH_CONDITIONS"];

const DECISION_ICONS: Record<DecisionType, LucideIcon> = {
  APPROVED: Check,
  APPROVED_WITH_CONDITIONS: ListChecks,
  DEFERRED: Hourglass,
  REJECTED: XCircle,
};

const STEP_TITLE = "flex items-center gap-2.5 text-base font-semibold";

/**
 * Section M decision (FR-M-001…017): outcome, conditions from the standard library (FR-M-011),
 * geographic scope (M.8), reasons and reason codes (FR-M-012), signed by confirming in a modal
 * within the approver's two-step-verified session (FR-M-013, UX-036), the practice arrangement derived from Sections F/G with an override (FR-M-009) and,
 * per condition, whether compliance evidence is required (FR-M-011). The server re-checks
 * segregation of duties (BR-091) and conflicts (BR-093).
 * Three numbered steps — choose, explain, sign — with the outcomes as SELECTED choice cards.
 */
export function DecisionForm({
  applicationId,
  districts,
  defaultScope,
  derivedArrangement,
  blocked,
}: {
  applicationId: string;
  districts: Array<{ code: string; name: string }>;
  defaultScope: string[];
  /** FR-M-009: what Sections F/G imply; the approver may choose another arrangement. */
  derivedArrangement: string;
  blocked: boolean;
}) {
  const t = useTranslations("decide.form");
  const tr = useTranslations("review");
  const td = useTranslations("decision.types");
  const tc = useTranslations("conditions");
  const tarr = useTranslations("arrangements");
  const arrangementLabel = (value: string) =>
    tarr.has(value) ? tarr(value as LicenceArrangement) : value;
  const router = useRouter();
  const translate = useErrorMessage();
  const { form, submit, pending } = useActionForm({
    schema: decisionSchema,
    defaultValues: {
      applicationId,
      decision: "APPROVED",
      conditions: [],
      geoScope: defaultScope,
      practiceArrangement: (LICENCE_ARRANGEMENTS as readonly string[]).includes(derivedArrangement)
        ? (derivedArrangement as LicenceArrangement)
        : undefined,
      reasons: "",
      reasonCodes: [],
    },
    action: async (values) => {
      const approval = APPROVALS.includes(values.decision);
      const result = await recordDecisionAction({
        ...values,
        conditions: values.decision === "APPROVED_WITH_CONDITIONS" ? values.conditions : [],
        geoScope: approval ? values.geoScope : [],
        practiceArrangement:
          approval && values.practiceArrangement !== derivedArrangement
            ? values.practiceArrangement || undefined
            : undefined,
        reasonCodes: values.decision === "REJECTED" ? values.reasonCodes : [],
        reasons: values.reasons || undefined,
      });
      // A refusal from the server brings the approver back to the form, errors in place.
      if (!result.ok) setConfirming(false);
      return result;
    },
    onSuccess: (_data, f) => {
      setConfirming(false);
      // "Validation completed", with the companion acting out the decision (UX-036).
      router.replace(
        `/backoffice/decisions/${applicationId}?recorded=1&celebrate=${f.getValues("decision")}` as never,
      );
      router.refresh();
    },
  });
  // Signing is a confirmation step (UX-036): the form validates first, then the modal asks.
  const [confirming, setConfirming] = useState(false);
  const review = (event: React.FormEvent) => {
    event.preventDefault();
    void form.trigger().then((ok) => (ok ? setConfirming(true) : submit()));
  };
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "conditions" });
  const errors = form.formState.errors;
  const decision = form.watch("decision");
  const scope = form.watch("geoScope") ?? [];
  const codes = form.watch("reasonCodes") ?? [];
  const approval = APPROVALS.includes(decision);
  const conditionsError =
    (errors.conditions as { message?: string } | undefined)?.message ??
    errors.conditions?.root?.message;

  const setScope = (next: string[]) =>
    form.setValue("geoScope", next, { shouldValidate: form.formState.isSubmitted });

  return (
    <form onSubmit={review} noValidate className="flex flex-col gap-6" data-testid="decision-form">
      <fieldset disabled={blocked || pending} className="flex flex-col gap-6 disabled:opacity-60">
        <fieldset className="flex flex-col gap-3">
          <legend className={cn(STEP_TITLE, "mb-3")}>
            <StepNumber n={1} /> {t("outcome")}
          </legend>
          <div className="grid gap-2.5 @lg/main:grid-cols-2">
            {DECISIONS.map((value) => {
              const selected = decision === value;
              const Icon = DECISION_ICONS[value];
              return (
                <label
                  key={value}
                  className={cn(
                    "relative flex cursor-pointer items-start gap-3 rounded-2xl p-4 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
                    INTERACTIVE,
                    selected
                      ? SELECTED
                      : cn(
                          "bg-card/60 ring-1 ring-foreground/[0.07] dark:bg-surface-2/50 dark:ring-white/[0.06]",
                          HOVER,
                        ),
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
                      value === "REJECTED"
                        ? "bg-danger-soft text-destructive"
                        : "bg-primary-soft text-link",
                    )}
                  >
                    <Icon className="size-[1.1rem]" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{td(value)}</span>
                    <span className="text-xs text-muted-foreground">{t(`hints.${value}`)}</span>
                  </span>
                  <input
                    type="radio"
                    value={value}
                    {...form.register("decision")}
                    className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                    data-testid={`decision-${value}`}
                  />
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-5">
          <h3 className={STEP_TITLE}>
            <StepNumber n={2} /> {t("details")}
          </h3>
          {decision === "APPROVED_WITH_CONDITIONS" && (
            <fieldset className="flex animate-rise flex-col gap-3">
              <legend className="mb-3 text-sm font-semibold">{t("conditions")}</legend>
              {fields.length > 0 && (
                <ol className="flex flex-col gap-3">
                  {fields.map((field, index) => {
                    const code = form.watch(`conditions.${index}.code`);
                    return (
                      <li
                        key={field.id}
                        className="flex flex-col gap-3 rounded-2xl bg-card/60 p-4 ring-1 ring-foreground/[0.07] dark:bg-surface-2/50 dark:ring-white/[0.06]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm font-semibold">
                            {index + 1}. {tc(code ?? "CUSTOM")}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => remove(index)}
                            aria-label={t("removeCondition", { n: index + 1 })}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                          <Field
                            label={code === "CUSTOM" ? t("conditionText") : t("conditionNote")}
                            error={errors.conditions?.[index]?.text?.message}
                          >
                            <FieldControl>
                              <Input
                                maxLength={300}
                                {...form.register(`conditions.${index}.text`)}
                                className="bg-card dark:bg-transparent"
                              />
                            </FieldControl>
                          </Field>
                          <Field
                            label={t("endsOn")}
                            error={errors.conditions?.[index]?.endsOn?.message}
                          >
                            <FieldControl>
                              <Input
                                type="date"
                                {...form.register(`conditions.${index}.endsOn`)}
                                className="bg-card dark:bg-transparent"
                              />
                            </FieldControl>
                          </Field>
                        </div>
                        <Controller
                          control={form.control}
                          name={`conditions.${index}.publicOnRegister`}
                          render={({ field: sw }) => (
                            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
                              <span>{t("public")}</span>
                              <Switch checked={sw.value ?? true} onCheckedChange={sw.onChange} />
                            </label>
                          )}
                        />
                        <Controller
                          control={form.control}
                          name={`conditions.${index}.evidenceRequired`}
                          render={({ field: sw }) => (
                            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
                              <span className="flex flex-col">
                                <span>{t("evidenceRequired")}</span>
                                <span className="text-xs text-muted-foreground">
                                  {t("evidenceRequiredHint")}
                                </span>
                              </span>
                              <Switch
                                checked={sw.value ?? false}
                                onCheckedChange={sw.onChange}
                                data-testid={`condition-${index}-evidence`}
                              />
                            </label>
                          )}
                        />
                      </li>
                    );
                  })}
                </ol>
              )}
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("addCondition")}>
                {[...STANDARD_CONDITIONS, "CUSTOM" as const].map((code) => (
                  <ChoicePill
                    key={code}
                    selected={false}
                    aria-pressed={undefined}
                    onClick={() =>
                      append({
                        code,
                        text: "",
                        endsOn: "",
                        publicOnRegister: true,
                        evidenceRequired: false,
                      })
                    }
                  >
                    <Plus aria-hidden className="text-link" /> {tc(code)}
                  </ChoicePill>
                ))}
              </div>
              {conditionsError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {translate(conditionsError)}
                </p>
              )}
            </fieldset>
          )}

          {approval && (
            <fieldset className="flex animate-rise flex-col gap-3">
              <legend className="mb-1 text-sm font-semibold">{t("scope")}</legend>
              <p className="text-sm text-muted-foreground">
                {scope.length === 0
                  ? t("scopeNationwide")
                  : t("scopeCount", { count: scope.length })}
              </p>
              <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
                <ChoicePill selected={scope.length === 0} onClick={() => setScope([])}>
                  <Globe2 aria-hidden className="text-link" /> {t("nationwide")}
                </ChoicePill>
                {districts.map((d) => {
                  const on = scope.includes(d.code);
                  return (
                    <ChoicePill
                      key={d.code}
                      selected={on}
                      onClick={() =>
                        setScope(on ? scope.filter((c) => c !== d.code) : [...scope, d.code])
                      }
                    >
                      {d.name}
                    </ChoicePill>
                  );
                })}
              </div>
            </fieldset>
          )}

          {approval && (
            <Field
              label={t("arrangement")}
              description={t("arrangementHint", { derived: arrangementLabel(derivedArrangement) })}
              error={errors.practiceArrangement?.message}
            >
              <FieldControl>
                <Controller
                  control={form.control}
                  name="practiceArrangement"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      data-testid="decision-arrangement"
                      options={LICENCE_ARRANGEMENTS.map((value) => ({
                        value,
                        label: `${arrangementLabel(value)}${value === derivedArrangement ? ` · ${t("derived")}` : ""}`,
                      }))}
                    />
                  )}
                />
              </FieldControl>
            </Field>
          )}

          {decision === "REJECTED" && (
            <fieldset className="flex animate-rise flex-col gap-3">
              <legend className="mb-3 text-sm font-semibold">{tr("form.reasonCodes")}</legend>
              <div className={LIST_GROUP}>
                {REJECTION_REASON_CODES.map((code) => (
                  <label
                    key={code}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 text-sm",
                      LIST_ROW,
                    )}
                  >
                    <Checkbox
                      checked={codes.includes(code)}
                      onCheckedChange={(on) =>
                        form.setValue(
                          "reasonCodes",
                          on === true ? [...codes, code] : codes.filter((c) => c !== code),
                          { shouldValidate: form.formState.isSubmitted },
                        )
                      }
                    />
                    {tr(`reasonCodes.${code}`)}
                  </label>
                ))}
              </div>
              {errors.reasonCodes?.message && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {translate(errors.reasonCodes.message)}
                </p>
              )}
            </fieldset>
          )}

          <Field
            label={decision === "APPROVED" ? t("reasonsOptional") : t("reasons")}
            description={t("reasonsHint")}
            error={errors.reasons?.message}
          >
            <FieldControl>
              <textarea
                rows={4}
                maxLength={2000}
                {...form.register("reasons")}
                className={cn(inputClass, "h-auto py-3")}
              />
            </FieldControl>
          </Field>
        </div>

        {/* Step 3: the signature (FR-M-013). */}
        <div className="flex flex-col gap-4 rounded-2xl bg-primary/[0.05] p-4 ring-1 ring-primary/15 dark:bg-primary/[0.1]">
          <h3 className={STEP_TITLE}>
            <StepNumber n={3} />
            <Signature className="size-4 text-link" aria-hidden /> {t("signStep")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("signHint")}</p>
          <Button
            type="submit"
            size="lg"
            loading={pending}
            disabled={blocked}
            data-testid="sign-decision"
            className="w-full @lg/main:w-fit @lg/main:self-end"
          >
            <Gavel /> {t("submit")}
          </Button>
        </div>
      </fieldset>
      <ConfirmSignDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={Gavel}
        title={t("confirmTitle")}
        description={t("confirmBody")}
        outcomeLabel={t("outcome")}
        outcome={td(decision)}
        danger={decision === "REJECTED"}
        confirmLabel={t("submit")}
        pending={pending}
        onConfirm={() => void submit()}
        testId="confirm-sign-decision"
      />
    </form>
  );
}
