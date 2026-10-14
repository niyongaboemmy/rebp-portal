"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { otpSchema } from "@rebp/contracts";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldControl } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { useActionForm } from "@/hooks/use-action-form";
import { useCopyToClipboard } from "@/hooks/use-copy";
import { confirmEnrolmentAction } from "@/server/actions/security";
import { useStepUp } from "./step-up";

interface TotpSetupProps {
  secret: string;
  qrDataUrl: string;
  onEnabled: (recoveryCodes: string[] | null) => void;
}

/** Authenticator enrolment: scan the QR (server-rendered data URL), confirm a code. Lazy-loaded. */
export default function TotpSetup({ secret, qrDataUrl, onEnabled }: TotpSetupProps) {
  const t = useTranslations();
  const stepUp = useStepUp();
  const { copied, copy } = useCopyToClipboard();
  const { form, submit, pending } = useActionForm({
    schema: z.object({ code: otpSchema }),
    defaultValues: { code: "" },
    action: ({ code }) => stepUp(() => confirmEnrolmentAction({ method: "TOTP", code })),
    onSuccess: ({ recoveryCodes }) => onEnabled(recoveryCodes),
  });
  const grouped = secret.match(/.{1,4}/g)?.join(" ") ?? secret;

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-5">
        <li className="flex flex-col gap-3">
          <p className="text-sm font-semibold">1. {t("security.mfa.totpSetup.step1")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL, nothing to optimise */}
          <img
            src={qrDataUrl}
            alt={t("security.mfa.totpSetup.qrAlt")}
            width={200}
            height={200}
            className="self-center rounded-xl border bg-white p-2"
          />
          <p className="text-xs text-muted-foreground">{t("security.mfa.totpSetup.manual")}</p>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
            <code
              className="font-mono text-sm break-all"
              data-testid="totp-secret"
              data-secret={secret}
            >
              {grouped}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => copy(secret)}
              aria-label={t("common.copy")}
            >
              <Copy />
            </Button>
          </div>
          {copied && (
            <span className="sr-only" aria-live="polite">
              {t("common.copied")}
            </span>
          )}
        </li>
        <li>
          <form onSubmit={submit} noValidate className="flex flex-col gap-3">
            <Field
              label={`2. ${t("security.mfa.totpSetup.step2")}`}
              error={form.formState.errors.code?.message}
            >
              <FieldControl>
                <OtpInput {...form.register("code")} />
              </FieldControl>
            </Field>
            <Button type="submit" loading={pending}>
              {t("common.confirm")}
            </Button>
          </form>
        </li>
      </ol>
    </div>
  );
}
