"use client";

import { KeyRound, MessageSquare, Mail, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { otpSchema, recoveryCodeSchema, type MfaMethod } from "@rebp/contracts";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useCountdown } from "@/hooks/use-countdown";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  resendTwoStepCodeAction,
  switchTwoStepMethodAction,
  verifyTwoStepAction,
} from "@/server/actions/auth";

const METHOD_ICONS: Record<MfaMethod, typeof Smartphone> = {
  TOTP: Smartphone,
  SMS: MessageSquare,
  EMAIL: Mail,
};

interface TwoStepFormProps {
  method: MfaMethod;
  methods: MfaMethod[];
  destination: string | null;
  next?: string;
}

const codeForm = z.object({ code: otpSchema });
const recoveryForm = z.object({ code: recoveryCodeSchema });

export function TwoStepForm({
  method: initialMethod,
  methods,
  destination,
  next,
}: TwoStepFormProps) {
  const t = useTranslations("auth.twoStep");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [method, setMethod] = useState(initialMethod);
  const [mode, setMode] = useState<"code" | "recovery" | "choose">("code");
  const [switching, startSwitch] = useTransition();
  const cooldown = useCountdown(method === "TOTP" ? 0 : 30);

  const onSuccess = ({ redirectTo }: { redirectTo: string }) => {
    router.replace(redirectTo as never);
    router.refresh();
  };
  const onError = (result: { error: string }) => {
    if (result.error === "errors.challengeExpired" || result.error === "errors.tooManyAttempts") {
      toast.error(errorMessage(result.error));
      router.replace("/sign-in");
      return true;
    }
  };

  const code = useActionForm({
    schema: codeForm,
    defaultValues: { code: "" },
    action: ({ code }) => verifyTwoStepAction({ kind: "code", code }, next),
    onSuccess,
    onError,
  });
  const recovery = useActionForm({
    schema: recoveryForm,
    defaultValues: { code: "" },
    action: ({ code }) => verifyTwoStepAction({ kind: "recovery", code }, next),
    onSuccess,
    onError,
  });

  const choose = (selected: MfaMethod) =>
    startSwitch(async () => {
      const result = await switchTwoStepMethodAction(selected);
      if (!result.ok) {
        toast.error(errorMessage(result.error, result.meta));
        return;
      }
      setMethod(selected);
      setMode("code");
      code.form.reset();
      cooldown.start(selected === "TOTP" ? 0 : 30);
    });

  const resend = () =>
    startSwitch(async () => {
      const result = await resendTwoStepCodeAction();
      if (result.ok) {
        toast.success(t("resent"));
        cooldown.start(30);
      } else {
        toast.error(errorMessage(result.error, result.meta));
        if (typeof result.meta?.retryAfterSeconds === "number")
          cooldown.start(result.meta.retryAfterSeconds);
      }
    });

  if (mode === "choose") {
    return (
      <div className="flex flex-col gap-3">
        {methods.map((m) => {
          const Icon = METHOD_ICONS[m];
          return (
            <Button
              key={m}
              variant="outline"
              size="lg"
              className="justify-start"
              loading={switching}
              onClick={() => choose(m)}
            >
              <Icon /> {t(`methods.${m}`)}
            </Button>
          );
        })}
        <Button
          variant="outline"
          size="lg"
          className="justify-start"
          onClick={() => setMode("recovery")}
        >
          <KeyRound /> {t("useRecovery")}
        </Button>
        <Button variant="ghost" onClick={() => setMode("code")}>
          {t("useCode")}
        </Button>
      </div>
    );
  }

  if (mode === "recovery") {
    return (
      <form onSubmit={recovery.submit} noValidate className="flex flex-col gap-5">
        <Field
          label={t("recoveryCode")}
          error={recovery.form.formState.errors.code?.message}
          description={t("recoveryHint")}
        >
          <FieldControl>
            <Input
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono uppercase"
              autoFocus
              {...recovery.form.register("code")}
            />
          </FieldControl>
        </Field>
        <Button type="submit" size="lg" loading={recovery.pending}>
          {t("submit")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setMode("code")}>
          {t("useCode")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={code.submit} noValidate className="flex flex-col gap-5">
      <p className="text-muted-foreground" aria-live="polite">
        {t(`subtitle.${method}`, { destination: destination ?? "" })}
      </p>
      <Field label={t("code")} error={code.form.formState.errors.code?.message}>
        <FieldControl>
          <OtpInput autoFocus {...code.form.register("code")} />
        </FieldControl>
      </Field>
      <Button type="submit" size="lg" loading={code.pending}>
        {t("submit")}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {method !== "TOTP" ? (
          <Button
            type="button"
            variant="link"
            disabled={cooldown.active || switching}
            onClick={resend}
          >
            {cooldown.active ? t("resendIn", { seconds: cooldown.seconds }) : t("resend")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" variant="link" onClick={() => setMode("choose")}>
          {t("tryAnother")}
        </Button>
      </div>
    </form>
  );
}
