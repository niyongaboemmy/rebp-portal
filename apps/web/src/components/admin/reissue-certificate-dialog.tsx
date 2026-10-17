"use client";

import { RotateCw } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { reissueCertificateSchema } from "@rebp/contracts";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { inputClass } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useActionForm } from "@/hooks/use-action-form";
import { cn } from "@/lib/utils";
import { reissueCertificateAction } from "@/server/actions/backoffice";

/**
 * FR-N-012 certificate reissue (lost, name or condition change): a new certificate version with
 * a new QR; the old QR then shows "superseded, see current". A reason of at least 10 characters
 * and the password (step-up, SEC-005) are required; the holder is notified.
 */
export function ReissueCertificateDialog({
  licenceId,
  licenceNo,
  version,
  onClose,
}: {
  licenceId: string;
  licenceNo: string;
  version: number;
  onClose: () => void;
}) {
  const t = useTranslations("registerAdmin.reissue");
  const router = useRouter();
  const { form, submit, pending } = useActionForm({
    schema: reissueCertificateSchema,
    defaultValues: { licenceId, reason: "", password: "" },
    action: reissueCertificateAction,
    onSuccess: (data) => {
      toast.success(t("done", { licence: licenceNo, version: data.certificateVersion }));
      router.refresh();
      onClose();
    },
  });
  const errors = form.formState.errors;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { licence: licenceNo, version })}</DialogDescription>
        </DialogHeader>
        <Alert variant="info">{t("qrNote")}</Alert>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field label={t("reason")} description={t("reasonHint")} error={errors.reason?.message}>
            <FieldControl>
              <textarea
                rows={3}
                maxLength={2000}
                {...form.register("reason")}
                className={cn(inputClass, "h-auto py-3")}
              />
            </FieldControl>
          </Field>
          <Field
            label={t("password")}
            description={t("passwordHint")}
            error={errors.password?.message}
          >
            <FieldControl>
              <PasswordInput autoComplete="current-password" {...form.register("password")} />
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button type="submit" loading={pending} data-testid="reissue-submit">
              <RotateCw /> {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
