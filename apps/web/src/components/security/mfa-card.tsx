"use client";

import { KeyRound, Mail, MessageSquare, Smartphone, Star } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MFA_METHODS, otpSchema, type MfaMethod } from "@rebp/contracts";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  beginOtpEnrolmentAction,
  beginTotpAction,
  confirmEnrolmentAction,
  disableMfaAction,
  regenerateRecoveryCodesAction,
  setPreferredMfaAction,
} from "@/server/actions/security";
import { DevCode } from "@/components/auth/dev-code";
import { useStepUp } from "./step-up";

// Code-split: enrolment UIs only load when the user starts a setup.
const TotpSetup = dynamic(() => import("./totp-setup"), {
  loading: () => <Skeleton className="h-80 w-full" />,
});
const RecoveryCodesDialog = dynamic(() => import("./recovery-codes-dialog"));

const ICONS: Record<MfaMethod, typeof Smartphone> = {
  TOTP: Smartphone,
  SMS: MessageSquare,
  EMAIL: Mail,
};

interface MfaCardProps {
  enabled: MfaMethod[];
  preferred: MfaMethod | null;
  phoneVerified: boolean;
  destinations: { SMS: string | null; EMAIL: string };
  recoveryRemaining: number;
  required: boolean;
}

export function MfaCard({
  enabled,
  preferred,
  phoneVerified,
  destinations,
  recoveryRemaining,
  required,
}: MfaCardProps) {
  const t = useTranslations("security");
  const router = useRouter();
  const stepUp = useStepUp();
  const errorMessage = useErrorMessage();
  const [busy, startTransition] = useTransition();
  const [setup, setSetup] = useState<{
    method: MfaMethod;
    totp?: { secret: string; qrDataUrl: string };
  } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const perform = (
    fn: () => Promise<{ ok: boolean; error?: string; meta?: Record<string, unknown> }>,
    success?: string,
  ) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
      if (success) toast.success(success);
      router.refresh();
    });

  const startSetup = (method: MfaMethod) =>
    startTransition(async () => {
      if (method === "TOTP") {
        const result = await stepUp(() => beginTotpAction());
        if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
        setSetup({ method, totp: result.data });
      } else {
        setSetup({ method });
      }
    });

  const finishSetup = (recoveryCodes: string[] | null) => {
    setSetup(null);
    toast.success(t("mfa.enabled"));
    if (recoveryCodes) setCodes(recoveryCodes);
    router.refresh();
  };

  const regenerate = () =>
    startTransition(async () => {
      const result = await stepUp(() => regenerateRecoveryCodesAction());
      if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
      setCodes(result.data.recoveryCodes);
      router.refresh();
    });

  return (
    <Card id="two-step">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>{t("mfa.title")}</CardTitle>
          <CardDescription>{t("mfa.description")}</CardDescription>
        </div>
        <Badge variant={enabled.length ? "success" : "outline"}>
          {enabled.length ? t("mfa.statusOn") : t("mfa.statusOff")}
        </Badge>
      </CardHeader>

      {required && enabled.length === 0 && <Alert variant="warning">{t("requiredBanner")}</Alert>}

      <ul className="flex flex-col divide-y rounded-xl border">
        {MFA_METHODS.map((method) => {
          const Icon = ICONS[method];
          const isOn = enabled.includes(method);
          const isPreferred = preferred === method;
          const blocked = method === "SMS" && !phoneVerified;
          return (
            <li
              key={method}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              data-testid={`mfa-${method.toLowerCase()}`}
            >
              <div className="flex flex-1 items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {t(`mfa.methods.${method}.name`)}
                    {isOn && <Badge variant="success">{t("mfa.statusOn")}</Badge>}
                    {isPreferred && (
                      <Badge variant="accent">
                        <Star /> {t("mfa.preferred")}
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`mfa.methods.${method}.description`)}
                  </p>
                  {blocked && !isOn && (
                    <p className="text-warning-strong text-xs font-medium">
                      {t("mfa.otpSetup.phoneRequired")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {isOn ? (
                  <>
                    {!isPreferred && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          perform(() => setPreferredMfaAction(method), t("mfa.preferredChanged"))
                        }
                      >
                        {t("mfa.makePreferred")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        perform(() => stepUp(() => disableMfaAction(method)), t("mfa.removed"))
                      }
                    >
                      {t("mfa.remove")}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || blocked}
                    onClick={() => startSetup(method)}
                  >
                    {t("mfa.setUp")}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {enabled.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-semibold">{t("recovery.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("recovery.description")} {t("recovery.remaining", { count: recoveryRemaining })}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={regenerate}>
            {t("recovery.regenerate")}
          </Button>
        </div>
      )}

      <Dialog open={Boolean(setup)} onOpenChange={(open) => !open && setSetup(null)}>
        <DialogContent>
          {setup?.method === "TOTP" && setup.totp ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("mfa.totpSetup.title")}</DialogTitle>
                <DialogDescription className="sr-only">
                  {t("mfa.methods.TOTP.description")}
                </DialogDescription>
              </DialogHeader>
              <TotpSetup
                secret={setup.totp.secret}
                qrDataUrl={setup.totp.qrDataUrl}
                onEnabled={finishSetup}
              />
            </>
          ) : setup ? (
            <OtpEnrolment
              method={setup.method as Exclude<MfaMethod, "TOTP">}
              destination={setup.method === "SMS" ? (destinations.SMS ?? "") : destinations.EMAIL}
              onEnabled={finishSetup}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <RecoveryCodesDialog codes={codes} onClose={() => setCodes(null)} />
    </Card>
  );
}

function OtpEnrolment({
  method,
  destination,
  onEnabled,
}: {
  method: Exclude<MfaMethod, "TOTP">;
  destination: string;
  onEnabled: (codes: string[] | null) => void;
}) {
  const t = useTranslations("security.mfa");
  const stepUp = useStepUp();
  const errorMessage = useErrorMessage();
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sending, startSend] = useTransition();
  const { form, submit, pending } = useActionForm({
    schema: z.object({ code: otpSchema }),
    defaultValues: { code: "" },
    action: ({ code }) => stepUp(() => confirmEnrolmentAction({ method, code })),
    onSuccess: ({ recoveryCodes }) => onEnabled(recoveryCodes),
  });
  const methodName = t(`methods.${method}.name`);

  const send = () =>
    startSend(async () => {
      const result = await stepUp(() => beginOtpEnrolmentAction(method));
      if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
      setSent(true);
      setDevCode(result.data.devCode);
      toast.success(t("otpSetup.sent"));
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("otpSetup.title", { method: methodName })}</DialogTitle>
        <DialogDescription>{t("otpSetup.intro", { destination })}</DialogDescription>
      </DialogHeader>
      {!sent ? (
        <Button onClick={send} loading={sending}>
          {t("otpSetup.send")}
        </Button>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <DevCode
            code={devCode}
            onUse={(value) => form.setValue("code", value, { shouldValidate: true })}
          />
          <Field label={methodName} error={form.formState.errors.code?.message}>
            <FieldControl>
              <OtpInput autoFocus {...form.register("code")} />
            </FieldControl>
          </Field>
          <Button type="submit" loading={pending}>
            {t("setUp")}
          </Button>
        </form>
      )}
    </>
  );
}
