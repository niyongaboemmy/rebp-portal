"use client";

import { cn } from "@/lib/utils";
import { PANEL } from "@/components/ui/surface";

import { useTranslations } from "next-intl";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { GatewayOutcome, PaymentStatus } from "@rebp/contracts";
import {
  CheckCircle2,
  Clock3,
  FlaskConical,
  Loader2,
  Smartphone,
  XCircle,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useErrorMessage } from "@/hooks/use-error-message";
import { refreshPaymentAction, simulateCheckoutAction } from "@/server/actions/applications";

/**
 * The sandbox gateway's hosted checkout. "Approve" and "Decline" deliver a signed webhook at once;
 * "Approve later" leaves the payment pending until reconciliation delivers it (FR-PAY-005), which
 * this page polls for.
 */
export function SandboxCheckout({
  reference,
  applicationId,
  applicationRef,
  amount,
  method,
  msisdn,
  status: initial,
}: {
  reference: string;
  applicationId: string;
  applicationRef: string;
  amount: string;
  method: string;
  msisdn: string | null;
  status: PaymentStatus;
}) {
  const t = useTranslations("payments.sandbox");
  const tm = useTranslations("payment.methods");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [local, setStatus] = useState<PaymentStatus | "WAITING">(initial);
  // A settled status from the server (after a refresh) wins over the local "waiting" state.
  const status = initial !== "PENDING" ? initial : local;
  const [pending, startTransition] = useTransition();
  const back = `/applications/${applicationId}` as Route;

  useEffect(() => {
    if (status !== "WAITING") return;
    const timer = setInterval(async () => {
      await refreshPaymentAction();
      router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [status, router]);

  const choose = (outcome: GatewayOutcome) =>
    startTransition(async () => {
      const result = await simulateCheckoutAction(reference, outcome);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setStatus(outcome === "delayed" ? "WAITING" : (result.data.status as PaymentStatus));
    });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-4">
      <div className="flex items-center gap-2 self-center rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-link">
        <FlaskConical className="size-3.5" aria-hidden /> {t("badge")}
      </div>
      <section aria-labelledby="checkout-title" className={cn("flex flex-col gap-5", PANEL)}>
        <div className="flex flex-col gap-1 text-center">
          <span className="text-xs font-bold tracking-widest text-link uppercase">
            {t("merchant")}
          </span>
          <h1 id="checkout-title" className="text-3xl font-bold num">
            {amount}
          </h1>
          <span className="text-sm text-muted-foreground">
            {t("for", { reference: applicationRef })}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{reference}</span>
        </div>

        {status === "PENDING" && (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]">
              <Smartphone className="size-5 text-link" aria-hidden />
              <div className="flex flex-col text-sm">
                <span className="font-semibold">{tm(method as "CARD")}</span>
                <span className="text-xs text-muted-foreground">
                  {method === "MOBILE_MONEY"
                    ? t("momoPrompt", { msisdn: msisdn ?? "" })
                    : t("otherPrompt")}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button size="lg" onClick={() => choose("success")} loading={pending}>
                <CheckCircle2 aria-hidden /> {t("approve")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => choose("delayed")}
                disabled={pending}
              >
                <Clock3 aria-hidden /> {t("later")}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => choose("failure")}
                disabled={pending}
              >
                <XCircle aria-hidden /> {t("decline")}
              </Button>
            </div>
          </>
        )}
        {status === "WAITING" && (
          <p
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary-soft p-4 text-sm"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t("waiting")}
          </p>
        )}
        {status === "PAID" && (
          <div className="flex flex-col items-center gap-3 text-center" role="status">
            <CheckCircle2 className="size-12 text-link" aria-hidden />
            <p className="font-semibold">{t("paid")}</p>
            <Button size="lg" onClick={() => router.push(`${back}?celebrate=1` as Route)}>
              {t("back")}
            </Button>
          </div>
        )}
        {(status === "FAILED" || status === "EXPIRED") && (
          <div className="flex flex-col items-center gap-3 text-center" role="status">
            <XCircle className="size-12 text-destructive" aria-hidden />
            <p className="font-semibold">{t("failed")}</p>
            <Button
              size="lg"
              onClick={() => router.push(`/applications/${applicationId}/pay` as Route)}
            >
              {t("retry")}
            </Button>
          </div>
        )}
      </section>
      <p className="text-center text-xs text-muted-foreground">{t("note")}</p>
    </div>
  );
}
