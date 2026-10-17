"use client";

import { Gavel, Globe2, Plus, Trash2 } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray } from "react-hook-form";
import {
  DECISIONS,
  decisionSchema,
  REJECTION_REASON_CODES,
  STANDARD_CONDITIONS,
  type DecisionType,
} from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { Field, FieldControl } from "@/components/ui/field";
import { Input, inputClass } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { recordDecisionAction } from "@/server/actions/backoffice";

const APPROVALS: readonly DecisionType[] = ["APPROVED", "APPROVED_WITH_CONDITIONS"];

/**
 * Section M decision (FR-M-001…017): outcome, conditions from the standard library (FR-M-011),
 * geographic scope (M.8), reasons and reason codes (FR-M-012), signed with the password
 * (FR-M-013). The server re-checks segregation of duties (BR-091) and conflicts (BR-093).
 */
export function DecisionForm({
  applicationId,
  districts,
  defaultScope,
  blocked,
}: {
  applicationId: string;
  districts: Array<{ code: string; name: string }>;
  defaultScope: string[];
  blocked: boolean;
}) {
  const t = useTranslations("decide.form");
  const tr = useTranslations("review");
  const td = useTranslations("decision.types");
  const tc = useTranslations("conditions");
  const router = useRouter();
  const translate = useErrorMessage();
  const { form, submit, pending } = useActionForm({
    schema: decisionSchema,
    defaultValues: {
      applicationId,
      decision: "APPROVED",
      conditions: [],
      geoScope: defaultScope,
      reasons: "",
      reasonCodes: [],
      password: "",
    },
    action: (values) => {
      const approval = APPROVALS.includes(values.decision);
      return recordDecisionAction({
        ...values,
        conditions: values.decision === "APPROVED_WITH_CONDITIONS" ? values.conditions : [],
        geoScope: approval ? values.geoScope : [],
        reasonCodes: values.decision === "REJECTED" ? values.reasonCodes : [],
        reasons: values.reasons || undefined,
      });
    },
    successMessage: t("recorded"),
    onSuccess: () => {
      router.replace(`/backoffice/decisions/${applicationId}?recorded=1` as never);
      router.refresh();
    },
  });
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
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" data-testid="decision-form">
      <fieldset disabled={blocked || pending} className="flex flex-col gap-6 disabled:opacity-60">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-base font-semibold">{t("outcome")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {DECISIONS.map((value) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-[background-color,border-color] duration-(--dur-2) has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
                  decision === value
                    ? "border-primary bg-primary/[0.06]"
                    : "bg-card hover:bg-surface-2",
                )}
              >
                <input
                  type="radio"
                  value={value}
                  {...form.register("decision")}
                  className="mt-1 size-4 accent-[var(--primary)]"
                  data-testid={`decision-${value}`}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{td(value)}</span>
                  <span className="text-xs text-muted-foreground">{t(`hints.${value}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {decision === "APPROVED_WITH_CONDITIONS" && (
          <fieldset className="flex animate-rise flex-col gap-3">
            <legend className="mb-3 text-base font-semibold">{t("conditions")}</legend>
            {fields.length > 0 && (
              <ol className="flex flex-col gap-3">
                {fields.map((field, index) => {
                  const code = form.watch(`conditions.${index}.code`);
                  return (
                    <li key={field.id} className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
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
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("addCondition")}>
              {[...STANDARD_CONDITIONS, "CUSTOM" as const].map((code) => (
                <Chip
                  key={code}
                  onClick={() => append({ code, text: "", endsOn: "", publicOnRegister: true })}
                >
                  <Plus aria-hidden /> {tc(code)}
                </Chip>
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
            <legend className="mb-1 text-base font-semibold">{t("scope")}</legend>
            <p className="text-sm text-muted-foreground">
              {scope.length === 0 ? t("scopeNationwide") : t("scopeCount", { count: scope.length })}
            </p>
            <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
              <Chip selected={scope.length === 0} onClick={() => setScope([])}>
                <Globe2 aria-hidden /> {t("nationwide")}
              </Chip>
              {districts.map((d) => {
                const on = scope.includes(d.code);
                return (
                  <Chip
                    key={d.code}
                    selected={on}
                    onClick={() =>
                      setScope(on ? scope.filter((c) => c !== d.code) : [...scope, d.code])
                    }
                  >
                    {d.name}
                  </Chip>
                );
              })}
            </div>
          </fieldset>
        )}

        {decision === "REJECTED" && (
          <fieldset className="flex animate-rise flex-col gap-3">
            <legend className="mb-3 text-base font-semibold">{tr("form.reasonCodes")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {REJECTION_REASON_CODES.map((code) => (
                <label
                  key={code}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm"
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

        <Field
          label={t("password")}
          description={t("passwordHint")}
          error={errors.password?.message}
        >
          <FieldControl>
            <PasswordInput autoComplete="current-password" {...form.register("password")} />
          </FieldControl>
        </Field>
      </fieldset>

      <div className="flex justify-end border-t pt-5">
        <Button
          type="submit"
          size="lg"
          loading={pending}
          disabled={blocked}
          data-testid="sign-decision"
        >
          <Gavel /> {t("submit")}
        </Button>
      </div>
    </form>
  );
}
