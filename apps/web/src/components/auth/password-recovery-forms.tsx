"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { forgotPasswordSchema, resetPasswordSchema } from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordInput, PasswordStrength } from "@/components/ui/password-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useCountdown } from "@/hooks/use-countdown";
import { useErrorMessage } from "@/hooks/use-error-message";
import { forgotPasswordAction, resetPasswordAction } from "@/server/actions/auth";
import { DevCode } from "./dev-code";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { form, submit, pending } = useActionForm({
    schema: forgotPasswordSchema,
    defaultValues: { email: "" },
    action: forgotPasswordAction,
    onSuccess: ({ email }) =>
      router.push(`/reset-password?email=${encodeURIComponent(email)}&sent=1`),
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label={t("signIn.email")} error={form.formState.errors.email?.message}>
        <FieldControl>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            {...form.register("email")}
          />
        </FieldControl>
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {t("forgot.submit")}
      </Button>
      <Button asChild variant="ghost">
        <Link href="/sign-in">{t("forgot.back")}</Link>
      </Button>
    </form>
  );
}

export function ResetPasswordForm({
  email,
  devCode: initialDevCode = null,
}: {
  email: string;
  devCode?: string | null;
}) {
  const t = useTranslations("auth.reset");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const cooldown = useCountdown(30);
  const [resending, startResend] = useTransition();
  const [devCode, setDevCode] = useState(initialDevCode);
  const { form, submit, pending } = useActionForm({
    schema: resetPasswordSchema,
    defaultValues: { email, code: "", password: "", confirmPassword: "" },
    action: resetPasswordAction,
    onSuccess: () => router.replace("/sign-in?reset=1"),
  });
  const { errors } = form.formState;

  const resend = () =>
    startResend(async () => {
      const result = await forgotPasswordAction({ email });
      if (result.ok) {
        setDevCode(result.data.devCode);
        cooldown.start(30);
        toast.success(t("resent"));
      } else {
        toast.error(errorMessage(result.error, result.meta));
      }
    });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <input type="hidden" {...form.register("email")} />
      <DevCode
        code={devCode}
        onUse={(value) => form.setValue("code", value, { shouldValidate: true })}
      />
      <Field
        label={t("code")}
        error={errors.code?.message}
        labelAction={
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={cooldown.active || resending}
            onClick={resend}
          >
            {cooldown.active ? t("resendIn", { seconds: cooldown.seconds }) : t("resend")}
          </Button>
        }
      >
        <FieldControl>
          <OtpInput autoFocus {...form.register("code")} />
        </FieldControl>
      </Field>
      <Field label={t("password")} error={errors.password?.message}>
        <FieldControl>
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </FieldControl>
      </Field>
      <PasswordStrength password={form.watch("password")} />
      <Field label={t("confirmPassword")} error={errors.confirmPassword?.message}>
        <FieldControl>
          <PasswordInput autoComplete="new-password" {...form.register("confirmPassword")} />
        </FieldControl>
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {t("submit")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/forgot-password"
          className="hit-area font-semibold text-primary hover:underline"
        >
          {t("differentEmail")}
        </Link>
      </p>
    </form>
  );
}
