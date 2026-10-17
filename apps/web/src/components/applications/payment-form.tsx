"use client";

import { useTranslations } from "next-intl";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { PaymentMethod } from "@rebp/contracts";
import { ArrowRight, Building2, Check, CreditCard, Lock, Smartphone } from "@/components/icons";
import { HOVER, INTERACTIVE, PANEL, SELECTED, SURFACE_MUTED } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { startPaymentAction } from "@/server/actions/applications";

const METHODS: Array<{ value: PaymentMethod; icon: typeof CreditCard }> = [
  { value: "MOBILE_MONEY", icon: Smartphone },
  { value: "CARD", icon: CreditCard },
  { value: "BANK", icon: Building2 },
];

/** FR-PAY-004: choose mobile money, card or bank, then continue to the gateway. */
export function PaymentForm({
  applicationId,
  phone,
  total,
}: {
  applicationId: string;
  phone: string | null;
  total: string;
}) {
  const t = useTranslations("payments");
  const tm = useTranslations("payment.methods");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("MOBILE_MONEY");
  const [msisdn, setMsisdn] = useState(phone ?? "");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const pay = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await startPaymentAction({
        applicationId,
        method,
        msisdn: method === "MOBILE_MONEY" ? msisdn : undefined,
      });
      if (!result.ok) {
        if (result.fieldErrors?.msisdn) setError(result.fieldErrors.msisdn);
        else toast.error(errorMessage(result.error));
        return;
      }
      router.push(result.data.redirect as Route);
    });

  return (
    <section aria-labelledby="method-title" className={cn("flex flex-col gap-5", PANEL)}>
      <h2 id="method-title" className="text-lg">
        {t("methodTitle")}
      </h2>
      <div className="grid gap-2.5" role="radiogroup" aria-labelledby="method-title">
        {METHODS.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={method === value}
            onClick={() => setMethod(value)}
            // The form's choice cards (UX-007): a tint when chosen, never a solid outline.
            className={cn(
              "flex items-center gap-3 rounded-2xl p-4 text-left",
              INTERACTIVE,
              method === value ? SELECTED : cn(SURFACE_MUTED, HOVER),
            )}
          >
            <span
              className={cn(
                "inline-flex size-10 items-center justify-center rounded-xl",
                method === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary-soft text-primary-soft-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{tm(value)}</span>
              <span className="text-xs text-muted-foreground">{t(`methodHints.${value}`)}</span>
            </span>
            {/* A soft tick on the chosen method. */}
            <span
              aria-hidden
              className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
                method === value
                  ? "bg-primary-soft text-link ring-1 ring-primary/30"
                  : "ring-2 ring-foreground/15 ring-inset",
              )}
            >
              {method === value && <Check className="size-3" strokeWidth={2.5} />}
            </span>
          </button>
        ))}
      </div>
      {method === "MOBILE_MONEY" && (
        <Field label={t("wallet")} description={t("walletHint")} error={error}>
          <FieldControl>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={msisdn}
              onChange={(e) => setMsisdn(e.target.value)}
              leading={<Smartphone />}
            />
          </FieldControl>
        </Field>
      )}
      <Button size="lg" onClick={pay} loading={pending} className="rounded-full">
        {t("payNow", { total })} <ArrowRight aria-hidden />
      </Button>
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden /> {t("secure")}
      </p>
    </section>
  );
}
