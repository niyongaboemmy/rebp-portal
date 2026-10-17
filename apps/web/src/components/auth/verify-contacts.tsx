"use client";

import { Check, CheckCircle2, Mail, Smartphone } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { otpSchema, updatePhoneSchema } from "@rebp/contracts";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useCountdown } from "@/hooks/use-countdown";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn, maskPhoneForDisplay } from "@/lib/utils";
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
  /** Where to go once both are verified: the dashboard, or the profile first (UX-010). */
  home?: string;
}

/**
 * FR-ACC-001: confirm email, then phone. One contact at a time: two tabs show both and tick as
 * they are confirmed; the active one asks for its 6-digit code. Finishing the first moves on to
 * the second; finishing both goes to the dashboard.
 */
export function VerifyContacts({
  email,
  phone: initialPhone,
  home = "/dashboard",
}: VerifyContactsProps) {
  const t = useTranslations("auth.verify");
  const router = useRouter();
  const [verified, setVerified] = useState({
    EMAIL: email.verified,
    PHONE: initialPhone?.verified ?? false,
  });
  const [phone, setPhone] = useState(initialPhone);
  const [active, setActive] = useState<Channel>(email.verified ? "PHONE" : "EMAIL");

  const onVerified = (channel: Channel, complete: boolean) => {
    setVerified((v) => ({ ...v, [channel]: true }));
    if (complete) {
      toast.success(t("allDone"));
      router.replace(home as never);
      router.refresh();
    } else if (channel === "EMAIL") setActive("PHONE");
  };

  const tabs: { channel: Channel; icon: typeof Mail; label: string }[] = [
    { channel: "EMAIL", icon: Mail, label: t("emailTitle") },
    { channel: "PHONE", icon: Smartphone, label: t("phoneTitle") },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Both contacts, ticked as they are confirmed. */}
      <div role="tablist" aria-label={t("title")} className="grid grid-cols-2 gap-2">
        {tabs.map(({ channel, icon: Icon, label }, i) => {
          const done = verified[channel];
          const on = active === channel;
          return (
            <button
              key={channel}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(channel)}
              className={cn(
                "flex items-center gap-3 rounded-2xl p-3 text-left transition-[background-color,box-shadow] duration-(--dur-2)",
                on
                  ? "bg-primary-soft shadow-[inset_0_0_0_1.5px_var(--primary)] dark:bg-primary/15"
                  : "bg-foreground/[0.04] hover:bg-foreground/[0.07] dark:bg-white/[0.04]",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
                  done
                    ? "bg-success text-white"
                    : on
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground dark:bg-white/[0.06]",
                )}
              >
                {done ? <Check className="size-4 animate-pop" /> : <Icon className="size-4" />}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.7rem] font-semibold text-muted-foreground">
                  {t("step", { n: i + 1 })}
                </span>
                <span className="truncate text-sm font-semibold">{label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div key={active} className="animate-rise [animation-duration:var(--dur-3)]">
        {active === "EMAIL" ? (
          <ContactCard
            channel="EMAIL"
            destination={email.display}
            verified={verified.EMAIL}
            initialDevCode={email.devCode}
            onVerified={onVerified}
          />
        ) : phone ? (
          <ContactCard
            key={phone.display}
            channel="PHONE"
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
    </div>
  );
}

const codeSchema = z.object({ code: otpSchema });

function ContactCard({
  channel,
  destination,
  verified,
  initialDevCode,
  onVerified,
}: {
  channel: Channel;
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

  if (verified)
    return (
      <p
        className="flex items-center gap-3 rounded-2xl bg-success-soft p-4 text-sm font-medium"
        data-testid={`verify-${channel.toLowerCase()}`}
      >
        <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
        {t("confirmed", { destination })}
      </p>
    );

  return (
    <form
      onSubmit={submit}
      noValidate
      data-wide
      data-testid={`verify-${channel.toLowerCase()}`}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-muted-foreground">{t("sentTo", { destination })}</p>
      <DevCode
        code={devCode}
        onUse={(value) => form.setValue("code", value, { shouldValidate: true })}
      />
      <Field label={t("codeLabel")} error={form.formState.errors.code?.message}>
        <FieldControl>
          <OtpInput webOtp={channel === "PHONE"} {...form.register("code")} />
        </FieldControl>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={pending} className="flex-1 sm:flex-none sm:px-10">
          {t("submit")}
        </Button>
        <Button type="button" variant="link" disabled={cooldown.active || sending} onClick={resend}>
          {cooldown.active ? t("resendIn", { seconds: cooldown.seconds }) : t("resend")}
        </Button>
      </div>
    </form>
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
    <form onSubmit={submit} noValidate data-wide className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("addPhone")}</p>
      <Field
        label={tSignUp("phone")}
        error={form.formState.errors.phone?.message}
        description={tSignUp("phoneHint")}
      >
        <FieldControl>
          <Input type="tel" autoComplete="tel" inputMode="tel" {...form.register("phone")} />
        </FieldControl>
      </Field>
      <Button type="submit" size="lg" loading={pending} className="sm:self-start sm:px-10">
        {t("addPhoneSubmit")}
      </Button>
    </form>
  );
}
