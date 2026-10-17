"use client";

import { AlertTriangle, ArrowRight, Building2, Mail, User } from "@/components/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";
import { signUpSchema, type AccountType } from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldControl } from "@/components/ui/field";
import { Flag } from "@/components/ui/flag";
import { Input } from "@/components/ui/input";
import { PasswordChecklist, PasswordInput, PasswordStrength } from "@/components/ui/password-input";
import { startRouteProgress } from "@/components/layout/route-progress";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { signUpAction } from "@/server/actions/auth";

const ACCOUNT_OPTIONS: {
  value: AccountType;
  icon: typeof User;
  label: "individual" | "organisation";
  hint: "individualHint" | "organisationHint";
}[] = [
  { value: "INDIVIDUAL", icon: User, label: "individual", hint: "individualHint" },
  { value: "ORGANISATION", icon: Building2, label: "organisation", hint: "organisationHint" },
];

export function SignUpForm() {
  const t = useTranslations("auth.signUp");
  const errorMessage = useErrorMessage();
  const tt = useTranslations("auth.toast");
  const router = useRouter();
  const { form, submit, pending } = useActionForm({
    schema: signUpSchema,
    defaultValues: {
      accountType: "INDIVIDUAL",
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptPrivacy: false as unknown as true,
    },
    action: signUpAction,
    successMessage: tt("created"),
    onSuccess: ({ redirectTo }) => {
      startRouteProgress();
      router.replace(redirectTo as never);
      router.refresh();
    },
  });
  const { errors } = form.formState;
  const accountType = form.watch("accountType");
  const password = form.watch("password");
  const confirmPassword = form.watch("confirmPassword");

  return (
    <form onSubmit={submit} noValidate data-wide className="flex flex-col gap-5">
      {/* Account type: a two-option segmented switch with a sliding highlight. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("accountType")}</legend>
        <div
          role="radiogroup"
          className="relative grid grid-cols-2 gap-1 rounded-2xl bg-foreground/[0.04] p-1 dark:bg-white/[0.05]"
        >
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-1 left-1 w-[calc(50%-0.375rem)] rounded-xl bg-card shadow-[0_1px_2px_oklch(0.3_0.08_264/0.1),0_4px_12px_-6px_oklch(0.3_0.12_264/0.3)] transition-transform duration-(--dur-4) ease-spring dark:bg-white/[0.09] dark:shadow-none",
              accountType === "ORGANISATION" && "translate-x-[calc(100%+0.25rem)]",
            )}
          />
          {ACCOUNT_OPTIONS.map(({ value, icon: Icon, label, hint }) => {
            const checked = accountType === value;
            return (
              <label
                key={value}
                className="relative flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40"
              >
                <input
                  type="radio"
                  value={value}
                  className="sr-only"
                  {...form.register("accountType")}
                />
                <span
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-(--dur-3)",
                    checked ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span
                    className={cn("text-sm font-semibold", !checked && "text-muted-foreground")}
                  >
                    {t(label)}
                  </span>
                  <span className="hidden truncate text-xs text-muted-foreground xs:block">
                    {t(hint)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field
        label={accountType === "ORGANISATION" ? t("fullNameOrg") : t("fullName")}
        error={errors.fullName?.message}
      >
        <FieldControl>
          <Input
            autoComplete={accountType === "ORGANISATION" ? "organization" : "name"}
            leading={accountType === "ORGANISATION" ? <Building2 /> : <User />}
            {...form.register("fullName")}
          />
        </FieldControl>
      </Field>
      <Field label={t("email")} error={errors.email?.message}>
        <FieldControl>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            leading={<Mail />}
            {...form.register("email")}
          />
        </FieldControl>
      </Field>
      {/* W-02: Rwanda cue; local (078…) and international (+250…) formats both work. */}
      <Field label={t("phone")} error={errors.phone?.message} description={t("phoneHint")}>
        <FieldControl>
          <Input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="078 123 4567"
            leading={<Flag locale="rw" className="h-3! w-4!" />}
            {...form.register("phone")}
          />
        </FieldControl>
      </Field>
      {/* Passwords side by side when there is room; strength and rules span both. */}
      <div className="flex flex-col gap-2.5">
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
          <Field label={t("password")} error={errors.password?.message}>
            <FieldControl>
              <PasswordInput autoComplete="new-password" {...form.register("password")} />
            </FieldControl>
          </Field>
          <Field label={t("confirmPassword")} error={errors.confirmPassword?.message}>
            <FieldControl>
              <PasswordInput autoComplete="new-password" {...form.register("confirmPassword")} />
            </FieldControl>
          </Field>
        </div>
        {password ? (
          <PasswordStrength password={password} />
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">{t("passwordHint")}</p>
        )}
        <PasswordChecklist password={password} confirm={confirmPassword} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <Controller
            control={form.control}
            name="acceptPrivacy"
            render={({ field }) => (
              <Checkbox
                id="acceptPrivacy"
                checked={field.value === true}
                onCheckedChange={(value) => field.onChange(value === true)}
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.acceptPrivacy) || undefined}
                className="mt-0.5"
              />
            )}
          />
          <label htmlFor="acceptPrivacy" className="text-sm leading-relaxed">
            {t.rich("acceptPrivacy", {
              link: (chunks) => (
                <Link href="/privacy" target="_blank" className="font-semibold text-link underline">
                  {chunks}
                </Link>
              ),
            })}
          </label>
        </div>
        {errors.acceptPrivacy && (
          <p
            role="alert"
            className="flex animate-rise items-start gap-1.5 text-xs font-medium text-destructive"
          >
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            {errorMessage(errors.acceptPrivacy.message)}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="rounded-full" loading={pending}>
        {t("submit")} <ArrowRight />
      </Button>
    </form>
  );
}
