"use client";

import { Building2, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";
import { signUpSchema, type AccountType } from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordChecklist, PasswordInput, PasswordStrength } from "@/components/ui/password-input";
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
    onSuccess: ({ redirectTo }) => {
      router.replace(redirectTo as never);
      router.refresh();
    },
  });
  const { errors } = form.formState;
  const accountType = form.watch("accountType");
  const password = form.watch("password");
  const confirmPassword = form.watch("confirmPassword");

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("accountType")}</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-3">
          {ACCOUNT_OPTIONS.map(({ value, icon: Icon, label, hint }) => {
            const checked = accountType === value;
            return (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40",
                  checked ? "border-primary bg-secondary" : "hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  value={value}
                  className="sr-only"
                  {...form.register("accountType")}
                />
                <Icon
                  className={cn("size-5", checked ? "text-link" : "text-muted-foreground")}
                  aria-hidden
                />
                <span className="text-sm font-semibold">{t(label)}</span>
                <span className="text-xs text-muted-foreground">{t(hint)}</span>
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
          <Input autoComplete="name" {...form.register("fullName")} />
        </FieldControl>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("email")} error={errors.email?.message}>
          <FieldControl>
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              {...form.register("email")}
            />
          </FieldControl>
        </Field>
        <Field label={t("phone")} error={errors.phone?.message} description={t("phoneHint")}>
          {/* W-02: Rwanda cue; local (078…) and international (+250…) formats both work. */}
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground"
            >
              RW
            </span>
            <FieldControl>
              <Input
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="078 123 4567"
                className="pl-12"
                {...form.register("phone")}
              />
            </FieldControl>
          </div>
        </Field>
      </div>
      <Field label={t("password")} error={errors.password?.message} description={t("passwordHint")}>
        <FieldControl>
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </FieldControl>
      </Field>
      <PasswordStrength password={password} />
      <Field label={t("confirmPassword")} error={errors.confirmPassword?.message}>
        <FieldControl>
          <PasswordInput autoComplete="new-password" {...form.register("confirmPassword")} />
        </FieldControl>
      </Field>
      <PasswordChecklist password={password} confirm={confirmPassword} />

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
          <p role="alert" className="text-xs font-medium text-destructive">
            {errorMessage(errors.acceptPrivacy.message)}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" loading={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
