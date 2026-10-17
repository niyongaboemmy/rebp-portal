"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ApplicationStatus } from "@rebp/contracts";
import { Bell, XCircle } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useErrorMessage } from "@/hooks/use-error-message";
import { remindAddresseeAction, withdrawApplicationAction } from "@/server/actions/applications";

/** Withdraw (FR-WF-005) with a confirmation dialog. */
export function ApplicationActions({
  applicationId,
  withdrawable,
}: {
  applicationId: string;
  status: ApplicationStatus;
  withdrawable: boolean;
}) {
  const t = useTranslations("applications.detail");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!withdrawable) return null;
  const withdraw = () =>
    startTransition(async () => {
      const result = await withdrawApplicationAction(applicationId);
      if (!result.ok) toast.error(errorMessage(result.error));
      else {
        toast.success(t("withdrawn"));
        setOpen(false);
        router.refresh();
      }
    });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <XCircle aria-hidden /> {t("withdraw")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("withdrawTitle")}</DialogTitle>
            <DialogDescription>{t("withdrawBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("keep")}
            </Button>
            <Button variant="destructive" onClick={withdraw} loading={pending}>
              {t("withdrawConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** FR-PORTAL-004 "Supervisor has not confirmed — Send reminder" (once a day). */
export function RemindButton({ confirmationId }: { confirmationId: string }) {
  const t = useTranslations("applications.detail");
  const errorMessage = useErrorMessage();
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="tonal"
      disabled={sent}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await remindAddresseeAction(confirmationId);
          if (!result.ok) toast.error(errorMessage(result.error));
          else {
            setSent(true);
            toast.success(t("reminded"));
          }
        })
      }
    >
      <Bell aria-hidden /> {sent ? t("remindedShort") : t("remind")}
    </Button>
  );
}
