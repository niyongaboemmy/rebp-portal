"use client";

import { CheckCircle2, Mail, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { otpSchema, updatePhoneSchema } from "@rebp/contracts";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { ProgressRing } from "@/components/data/progress-ring";
import { useActionForm } from "@/hooks/use-action-form";
import { useCountdown } from "@/hooks/use-countdown";
import { useErrorMessage } from "@/hooks/use-error-message";
import { maskPhoneForDisplay } from "@/lib/utils";
import { sendVerificationCodeAction, verifyContactAction } from "@/server/actions/auth";
import { updatePhoneAction } from "@/server/actions/security";
import { DevCode } from "./dev-code";

type Channel = "EMAIL" | "PHONE";

interface ContactInfo {
  display: string;
  verified: boolean;
  /** APP_ENV=dev only. */
  devCode: string | null;
}

interface VerifyContactsProps {
  email: ContactInfo;
  phone: ContactInfo | null;
}

export function VerifyContacts({ email, phone: initialPhone }: VerifyContactsProps) {
  const t = useTranslations("auth.verify");
  const router = useRouter();
  const [verified, setVerified] = useState({
    EMAIL: email.verified,
    PHONE: initialPhone?.verified ?? false,
  });
  const [phone, setPhone] = useState(initialPhone);

  const onVerified = (channel: Channel, complete: boolean) => {
    setVerified((v) => ({ ...v, [channel]: true }));
    if (complete) {
      toast.success(t("allDone"));
      router.replace("/dashboard");
      router.refresh();
    }
  };

  const done = Number(verified.EMAIL) + Number(verified.PHONE);
  return (
    <div className="flex flex-col gap-4">
      {/* W-03: overall progress across both contacts. */}
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3" aria-live="polite">
        <ProgressRing
          value={done}
          total={2}
          tone={done === 2 ? "good" : undefined}
          className="size-11"
          label={t("progress", { done, total: 2 })}
        >
          <span className="text-xs font-bold num">{done}/2</span>
        </ProgressRing>
        <span className="text-sm font-medium">{t("progress", { done, total: 2 })}</span>
      </div>
      <ContactCard
        channel="EMAIL"
        icon={Mail}
        title={t("emailTitle")}
        destination={email.display}
        verified={verified.EMAIL}
        initialDevCode={email.devCode}
        onVerified={onVerified}
      />
      {phone ? (
        <ContactCard
          key={phone.display}
          channel="PHONE"
          icon={Smartphone}
          title={t("phoneTitle")}
          destination={phone.display}
          verified={verified.PHONE}
          initialDevCode={phone.devCode}
          onVerified={onVerified}
        />
      ) : (
        <AddPhoneCard
          onAdded={(display, devCode) => setPhone({ display, verified: false, devCode })}
        />
      )}
    </div>
  );
}

const codeSchema = z.object({ code: otpSchema });

function ContactCard({
  channel,
  icon: Icon,
  title,
  destination,
  verified,
  initialDevCode,
  onVerified,
}: {
  channel: Channel;
  icon: typeof Mail;
  title: string;
  destination: string;
  verified: boolean;
  initialDevCode: string | null;
  onVerified: (channel: Channel, complete: boolean) => void;
}) {
  const t = useTranslations("auth.verify");
  const errorMessage = useErrorMessage();
  const cooldown = useCountdown(30);
  const [sending, startSend] = useTransition();
  const [devCode, setDevCode] = useState(initialDevCode);
  const { form, submit, pending } = useActionForm({
    schema: codeSchema,
    defaultValues: { code: "" },
    action: ({ code }) => verifyContactAction({ channel, code }),
    onSuccess: ({ complete }) => onVerified(channel, complete),
  });

  const resend = () =>
    startSend(async () => {
      const result = await sendVerificationCodeAction(channel);
      if (result.ok) {
        cooldown.start(30);
        setDevCode(result.data.devCode);
        form.reset();
        toast.success(t("resent"));
      } else {
        toast.error(errorMessage(result.error, result.meta));
        if (typeof result.meta?.retryAfterSeconds === "number")
          cooldown.start(result.meta.retryAfterSeconds);
      }
    });

  return (
    <Card className="gap-4" data-testid={`verify-${channel.toLowerCase()}`}>
      <CardHeader className="flex-row items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="truncate text-sm text-muted-foreground">
            {verified ? destination : t("sentTo", { destination })}
          </p>
        </div>
        {verified && (
          <Badge variant="success" className="animate-in zoom-in-50">
            <CheckCircle2 /> {t("done")}
          </Badge>
        )}
      </CardHeader>
      {!verified && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <DevCode
            code={devCode}
            onUse={(value) => form.setValue("code", value, { shouldValidate: true })}
          />
          <Field label={t("codeLabel")} error={form.formState.errors.code?.message}>
            <FieldControl>
              <OtpInput webOtp={channel === "PHONE"} {...form.register("code")} />
            </FieldControl>
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={pending}>
              {t("submit")}
            </Button>
            <Button
              type="button"
              variant="link"
              disabled={cooldown.active || sending}
              onClick={resend}
            >
              {cooldown.active ? t("resendIn", { seconds: cooldown.seconds }) : t("resend")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function AddPhoneCard({ onAdded }: { onAdded: (display: string, devCode: string | null) => void }) {
  const t = useTranslations("auth.verify");
  const tSignUp = useTranslations("auth.signUp");
  const { form, submit, pending } = useActionForm({
    schema: updatePhoneSchema,
    defaultValues: { phone: "" },
    action: updatePhoneAction,
    onSuccess: ({ phone, devCode }): void => onAdded(maskPhoneForDisplay(phone ?? ""), devCode),
  });
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">{t("addPhone")}</CardTitle>
      </CardHeader>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field
          label={tSignUp("phone")}
          error={form.formState.errors.phone?.message}
          description={tSignUp("phoneHint")}
        >
          <FieldControl>
            <Input type="tel" autoComplete="tel" inputMode="tel" {...form.register("phone")} />
          </FieldControl>
        </Field>
        <Button type="submit" loading={pending}>
          {t("addPhoneSubmit")}
        </Button>
      </form>
    </Card>
  );
}
