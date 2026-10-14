"use client";

import { CheckCircle2, Mail, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { otpSchema, updatePhoneSchema } from "@rebp/contracts";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useCountdown } from "@/hooks/use-countdown";
import { useErrorMessage } from "@/hooks/use-error-message";
import { sendVerificationCodeAction, verifyContactAction } from "@/server/actions/auth";
import { updatePhoneAction } from "@/server/actions/security";

type Channel = "EMAIL" | "PHONE";

interface VerifyContactsProps {
  email: { display: string; verified: boolean };
  phone: { display: string; verified: boolean } | null;
  showDevHint: boolean;
}

export function VerifyContacts({ email, phone, showDevHint }: VerifyContactsProps) {
  const t = useTranslations("auth.verify");
  const router = useRouter();
  const [verified, setVerified] = useState({
    EMAIL: email.verified,
    PHONE: phone?.verified ?? false,
  });
  const [phoneDisplay, setPhoneDisplay] = useState(phone?.display ?? null);

  const onVerified = (channel: Channel, complete: boolean) => {
    setVerified((v) => ({ ...v, [channel]: true }));
    if (complete) {
      toast.success(t("allDone"));
      router.replace("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {showDevHint && (
        <Alert variant="info">
          {t.rich("devHint", {
            link: (chunks) => (
              <Link href="/dev/outbox" target="_blank">
                {chunks}
              </Link>
            ),
          })}
        </Alert>
      )}
      <ContactCard
        channel="EMAIL"
        icon={Mail}
        title={t("emailTitle")}
        destination={email.display}
        verified={verified.EMAIL}
        onVerified={onVerified}
      />
      {phoneDisplay ? (
        <ContactCard
          channel="PHONE"
          icon={Smartphone}
          title={t("phoneTitle")}
          destination={phoneDisplay}
          verified={verified.PHONE}
          onVerified={onVerified}
        />
      ) : (
        <AddPhoneCard onAdded={(display) => setPhoneDisplay(display)} />
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
  onVerified,
}: {
  channel: Channel;
  icon: typeof Mail;
  title: string;
  destination: string;
  verified: boolean;
  onVerified: (channel: Channel, complete: boolean) => void;
}) {
  const t = useTranslations("auth.verify");
  const errorMessage = useErrorMessage();
  const cooldown = useCountdown(30);
  const [sending, startSend] = useTransition();
  const { form, submit, pending } = useActionForm({
    schema: codeSchema,
    defaultValues: { code: "" },
    action: ({ code }) => verifyContactAction({ channel, code }),
    onSuccess: ({ complete }) => onVerified(channel, complete),
  });

  const resend = () =>
    startSend(async () => {
      const result = await sendVerificationCodeAction(channel);
      if (result.ok) cooldown.start(30);
      else {
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
          <Badge variant="success">
            <CheckCircle2 /> {t("done")}
          </Badge>
        )}
      </CardHeader>
      {!verified && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <Field label={t("codeLabel")} error={form.formState.errors.code?.message}>
            <FieldControl>
              <OtpInput {...form.register("code")} />
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

function AddPhoneCard({ onAdded }: { onAdded: (display: string) => void }) {
  const t = useTranslations("auth.verify");
  const tSignUp = useTranslations("auth.signUp");
  const { form, submit, pending } = useActionForm({
    schema: updatePhoneSchema,
    defaultValues: { phone: "" },
    action: updatePhoneAction,
    onSuccess: (_data, form): void => onAdded(form.getValues("phone")),
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
