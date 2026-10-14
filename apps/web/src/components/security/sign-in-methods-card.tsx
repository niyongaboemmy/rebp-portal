"use client";

import { KeyRound } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changePasswordSchema } from "@rebp/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { PasswordInput, PasswordStrength } from "@/components/ui/password-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorMessage } from "@/hooks/use-error-message";
import { changePasswordAction, unlinkGoogleAction } from "@/server/actions/security";
import { useStepUp } from "./step-up";

interface SignInMethodsCardProps {
  hasPassword: boolean;
  passwordChangedAt: string | null;
  google: { linked: boolean; email: string | null; available: boolean };
}

export function SignInMethodsCard({
  hasPassword,
  passwordChangedAt,
  google,
}: SignInMethodsCardProps) {
  const t = useTranslations("security.methods");
  const router = useRouter();
  const stepUp = useStepUp();
  const errorMessage = useErrorMessage();
  const [busy, startTransition] = useTransition();

  const unlink = () =>
    startTransition(async () => {
      const result = await stepUp(() => unlinkGoogleAction());
      if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
      toast.success(t("googleUnlinked"));
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <ul className="flex flex-col divide-y rounded-xl border">
        <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <KeyRound className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">{t("password")}</p>
              <p className="text-sm text-muted-foreground">
                {hasPassword
                  ? t("passwordSet", { date: passwordChangedAt ?? "—" })
                  : t("passwordNotSet")}
              </p>
            </div>
          </div>
          <PasswordDialog hasPassword={hasPassword} />
        </li>
        <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-3">
            <span
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border bg-white font-bold text-[#4285F4]"
              aria-hidden
            >
              G
            </span>
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-2 font-semibold">
                {t("google")}{" "}
                {google.linked && (
                  <Badge variant="success">
                    {t("googleLinked", { email: google.email ?? "" })}
                  </Badge>
                )}
              </p>
              {!google.linked && (
                <p className="text-sm text-muted-foreground">{t("googleNotLinked")}</p>
              )}
            </div>
          </div>
          {google.linked ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={unlink}>
              {t("unlinkGoogle")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={!google.available}
              asChild={google.available}
            >
              {google.available ? (
                <a href="/api/auth/google?intent=link">{t("linkGoogle")}</a>
              ) : (
                <span>{t("linkGoogle")}</span>
              )}
            </Button>
          )}
        </li>
      </ul>
    </Card>
  );
}

function PasswordDialog({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("security.methods");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, submit, pending } = useActionForm({
    schema: changePasswordSchema,
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
    action: changePasswordAction,
    onSuccess: () => {
      toast.success(t("passwordUpdated"));
      form.reset();
      setOpen(false);
      router.refresh();
    },
  });
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {hasPassword ? t("changePassword") : t("setPassword")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hasPassword ? t("changePassword") : t("setPassword")}</DialogTitle>
          <DialogDescription className="sr-only">{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {hasPassword && (
            <Field label={t("currentPassword")} error={errors.currentPassword?.message}>
              <FieldControl>
                <PasswordInput
                  autoComplete="current-password"
                  {...form.register("currentPassword")}
                />
              </FieldControl>
            </Field>
          )}
          <Field label={t("newPassword")} error={errors.password?.message}>
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
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {hasPassword ? t("changePassword") : t("setPassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
