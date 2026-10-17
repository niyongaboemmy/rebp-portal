"use client";

import { Send } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, type FieldError, type UseFormRegisterReturn } from "react-hook-form";
import {
  CATEGORIES,
  proposeConfigSchema,
  type FeatureFlags,
  type FeeSchedule,
  type RuleThresholds,
} from "@rebp/contracts";
import { useStepUp } from "@/components/security/step-up";
import { Button } from "@/components/ui/button";
import { Field, FieldControl } from "@/components/ui/field";
import { Input, inputClass } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useActionForm } from "@/hooks/use-action-form";
import { cn } from "@/lib/utils";
import { proposeConfigAction } from "@/server/actions/backoffice";

/**
 * Configuration proposals (FR-ADM-002…004): a maker proposes a new version with an effective date
 * and a reason; a different checker approves it. Proposing is a sensitive action (step-up).
 */
const [feesSchema, thresholdsSchema, flagsSchema] = proposeConfigSchema.options;

/** Zod's own number messages are not i18n keys: show one friendly message for any bad number. */
const numberError = (error: FieldError | undefined) =>
  error ? "configuration.form.invalidNumber" : undefined;

interface FormProps<T> {
  current: T;
  today: string;
  disabled: boolean;
}

function useProposalSuccess() {
  const router = useRouter();
  return () => router.refresh();
}

export function FeesProposalForm({ current, today, disabled }: FormProps<FeeSchedule>) {
  const t = useTranslations();
  const stepUp = useStepUp();
  const refresh = useProposalSuccess();
  const { form, submit, pending } = useActionForm({
    schema: feesSchema,
    defaultValues: { key: "fees", value: current, effectiveFrom: today, reason: "" },
    action: (values) => stepUp(() => proposeConfigAction(values)),
    successMessage: t("configuration.form.proposed"),
    onSuccess: refresh,
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <fieldset disabled={disabled} className="flex flex-col gap-5">
        <legend className="sr-only">{t("configuration.tabs.fees")}</legend>
        <ul className="flex flex-col overflow-hidden rounded-2xl border">
          <li
            aria-hidden
            className="hidden grid-cols-[1fr_9rem_9rem] gap-3 border-b bg-surface-2 px-4 py-2 text-xs font-semibold text-muted-foreground sm:grid"
          >
            <span>{t("configuration.fees.category")}</span>
            <span>{t("configuration.fees.registration")}</span>
            <span>{t("configuration.fees.licensing")}</span>
          </li>
          {CATEGORIES.map((cat) => (
            <li
              key={cat}
              className="grid grid-cols-2 gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_9rem_9rem] sm:items-center"
            >
              <span className="col-span-2 text-sm font-semibold sm:col-span-1">
                {t(`categories.items.${cat}.name`)}
              </span>
              <Field
                label={<span className="sm:sr-only">{t("configuration.fees.registration")}</span>}
                error={numberError(errors.value?.fees?.[cat]?.registration)}
                className="gap-1"
              >
                <FieldControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    {...form.register(`value.fees.${cat}.registration`, { valueAsNumber: true })}
                  />
                </FieldControl>
              </Field>
              <Field
                label={<span className="sm:sr-only">{t("configuration.fees.licensing")}</span>}
                error={numberError(errors.value?.fees?.[cat]?.licensing)}
                className="gap-1"
              >
                <FieldControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    {...form.register(`value.fees.${cat}.licensing`, { valueAsNumber: true })}
                  />
                </FieldControl>
              </Field>
            </li>
          ))}
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("configuration.fees.latePenalty")}
            description={t("configuration.fees.latePenaltyHint")}
            error={numberError(errors.value?.latePenaltyPercent)}
          >
            <FieldControl>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={200}
                step={1}
                {...form.register("value.latePenaltyPercent", { valueAsNumber: true })}
              />
            </FieldControl>
          </Field>
          <Field
            label={t("configuration.fees.reference")}
            description={t("configuration.fees.referenceHint")}
            error={errors.value?.reference ? "validation.required" : undefined}
          >
            <FieldControl>
              <Input maxLength={120} {...form.register("value.reference")} />
            </FieldControl>
          </Field>
        </div>
        <Controller
          control={form.control}
          name="value.sample"
          render={({ field }) => (
            <SwitchRow
              id="fees-sample"
              label={t("configuration.fees.sample")}
              description={t("configuration.fees.sampleHint")}
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <ProposalMeta
          effective={form.register("effectiveFrom")}
          reason={form.register("reason")}
          effectiveError={errors.effectiveFrom ? "validation.required" : undefined}
          reasonError={errors.reason?.message}
        />
      </fieldset>
      <SubmitRow pending={pending} disabled={disabled} />
    </form>
  );
}

const THRESHOLD_FIELDS = [
  "minAge",
  "reaExperienceMonths",
  "brokerExperienceMonths",
  "examValidityYears",
  "criminalRecordMonths",
  "renewalWindowDays",
  "graceDays",
  "licenceValidityYears",
  "brokerExpiryWarningDays",
] as const satisfies readonly (keyof RuleThresholds)[];

export function ThresholdsProposalForm({ current, today, disabled }: FormProps<RuleThresholds>) {
  const t = useTranslations();
  const stepUp = useStepUp();
  const refresh = useProposalSuccess();
  const { form, submit, pending } = useActionForm({
    schema: thresholdsSchema,
    defaultValues: { key: "thresholds", value: current, effectiveFrom: today, reason: "" },
    action: (values) => stepUp(() => proposeConfigAction(values)),
    successMessage: t("configuration.form.proposed"),
    onSuccess: refresh,
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <fieldset disabled={disabled} className="flex flex-col gap-5">
        <legend className="sr-only">{t("configuration.tabs.thresholds")}</legend>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {THRESHOLD_FIELDS.map((name) => (
            <Field
              key={name}
              label={t(`configuration.thresholds.fields.${name}.label`)}
              description={t(`configuration.thresholds.fields.${name}.hint`)}
              error={numberError(errors.value?.[name])}
            >
              <FieldControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  {...form.register(`value.${name}`, { valueAsNumber: true })}
                />
              </FieldControl>
            </Field>
          ))}
        </div>
        <Controller
          control={form.control}
          name="value.reraCountsForRea"
          render={({ field }) => (
            <SwitchRow
              id="rera-counts"
              label={t("configuration.thresholds.fields.reraCountsForRea.label")}
              description={t("configuration.thresholds.fields.reraCountsForRea.hint")}
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <ProposalMeta
          effective={form.register("effectiveFrom")}
          reason={form.register("reason")}
          effectiveError={errors.effectiveFrom ? "validation.required" : undefined}
          reasonError={errors.reason?.message}
        />
      </fieldset>
      <SubmitRow pending={pending} disabled={disabled} />
    </form>
  );
}

const FLAG_FIELDS = [
  "genderField",
  "publicPhoto",
  "indemnityRequired",
  "autoAssign",
] as const satisfies readonly (keyof FeatureFlags)[];

export function FlagsProposalForm({ current, today, disabled }: FormProps<FeatureFlags>) {
  const t = useTranslations();
  const stepUp = useStepUp();
  const refresh = useProposalSuccess();
  const { form, submit, pending } = useActionForm({
    schema: flagsSchema,
    defaultValues: { key: "flags", value: current, effectiveFrom: today, reason: "" },
    action: (values) => stepUp(() => proposeConfigAction(values)),
    successMessage: t("configuration.form.proposed"),
    onSuccess: refresh,
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <fieldset disabled={disabled} className="flex flex-col gap-5">
        <legend className="sr-only">{t("configuration.tabs.flags")}</legend>
        <div className="flex flex-col overflow-hidden rounded-2xl border">
          {FLAG_FIELDS.map((name) => (
            <Controller
              key={name}
              control={form.control}
              name={`value.${name}`}
              render={({ field }) => (
                <SwitchRow
                  id={`flag-${name}`}
                  label={t(`configuration.flags.fields.${name}.label`)}
                  description={t(`configuration.flags.fields.${name}.hint`)}
                  checked={field.value}
                  onChange={field.onChange}
                  className="rounded-none border-0 border-b last:border-b-0"
                />
              )}
            />
          ))}
        </div>
        <ProposalMeta
          effective={form.register("effectiveFrom")}
          reason={form.register("reason")}
          effectiveError={errors.effectiveFrom ? "validation.required" : undefined}
          reasonError={errors.reason?.message}
        />
      </fieldset>
      <SubmitRow pending={pending} disabled={disabled} />
    </form>
  );
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
  className,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border p-4", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={`${id}-hint`}
      />
    </div>
  );
}

function ProposalMeta({
  effective,
  reason,
  effectiveError,
  reasonError,
}: {
  effective: UseFormRegisterReturn;
  reason: UseFormRegisterReturn;
  effectiveError?: string;
  reasonError?: string;
}) {
  const t = useTranslations("configuration.form");
  return (
    <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
      <Field label={t("effectiveFrom")} description={t("effectiveHint")} error={effectiveError}>
        <FieldControl>
          <Input type="date" {...effective} />
        </FieldControl>
      </Field>
      <Field label={t("reason")} description={t("reasonHint")} error={reasonError}>
        <FieldControl>
          <textarea
            rows={3}
            maxLength={500}
            className={cn(inputClass, "h-auto min-h-24 py-3 leading-relaxed")}
            {...reason}
          />
        </FieldControl>
      </Field>
    </div>
  );
}

function SubmitRow({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  const t = useTranslations("configuration.form");
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <p className="text-xs text-muted-foreground">{t("submitHint")}</p>
      <Button type="submit" loading={pending} disabled={disabled}>
        <Send /> {t("submit")}
      </Button>
    </div>
  );
}
