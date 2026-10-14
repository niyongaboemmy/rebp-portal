"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signInSchema } from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useActionForm } from "@/hooks/use-action-form";
import { signInAction } from "@/server/actions/auth";

export function SignInForm({ next }: { next?: string }) {
  const t = useTranslations("auth.signIn");
  const router = useRouter();
  const { form, submit, pending } = useActionForm({
    schema: signInSchema,
    defaultValues: { email: "", password: "", next },
    action: signInAction,
    onSuccess: ({ redirectTo }) => {
      router.replace(redirectTo as never);
      router.refresh();
    },
  });
  const { errors } = form.formState;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label={t("email")} error={errors.email?.message}>
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
      <Field
        label={t("password")}
        error={errors.password?.message}
        labelAction={
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t("forgot")}
          </Link>
        }
      >
        <FieldControl>
          <PasswordInput autoComplete="current-password" {...form.register("password")} />
        </FieldControl>
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
