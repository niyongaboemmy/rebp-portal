"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CHECKED_REGISTER_ACTIONS,
  registerActionSchema,
  type RegisterAction,
} from "@rebp/contracts";
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
import { Input, inputClass } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { cn } from "@/lib/utils";
import { proposeRegisterChangeAction } from "@/server/actions/backoffice";

interface RegisterActionDialogProps {
  licenceId: string;
  licenceNo: string;
  displayName: string;
  action: RegisterAction;
  /** Today in Kigali (YYYY-MM-DD), the default suspension start. */
  today: string;
  onClose: () => void;
}

/**
 * One register change (FR-RA-001/002): suspend (with dates), lift, revoke (maker-checker),
 * record a surrender or correct the public name — always with a reason and a reference.
 */
export function RegisterActionDialog({
  licenceId,
  licenceNo,
  displayName,
  action,
  today,
  onClose,
}: RegisterActionDialogProps) {
  const t = useTranslations("registerAdmin");
  const router = useRouter();
  const checked = CHECKED_REGISTER_ACTIONS.includes(action);
  const { form, submit, pending } = useActionForm({
    schema: registerActionSchema,
    defaultValues: {
      licenceId,
      action,
      reason: "",
      reference: "",
      startsOn: action === "SUSPEND" ? today : "",
      endsOn: "",
      displayName: action === "CORRECT" ? displayName : undefined,
    },
    action: proposeRegisterChangeAction,
    onSuccess: (data) => {
      toast.success(
        data.applied
          ? t("actionDialog.applied", { licence: licenceNo })
          : t("actionDialog.awaiting", { licence: licenceNo }),
      );
      router.refresh();
      onClose();
    },
  });
  const errors = form.formState.errors;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`actions.${action}.title`)}</DialogTitle>
          <DialogDescription>
            {t(`actions.${action}.description`, { licence: licenceNo })}
          </DialogDescription>
        </DialogHeader>
        {checked && <Alert variant="info">{t("actionDialog.makerCheckerNote")}</Alert>}
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {action === "SUSPEND" && (
            <div className="grid gap-4 xs:grid-cols-2">
              <Field label={t("actionDialog.startsOn")} error={errors.startsOn?.message}>
                <FieldControl>
                  <Input type="date" {...form.register("startsOn")} />
                </FieldControl>
              </Field>
              <Field
                label={t("actionDialog.endsOn")}
                description={t("actionDialog.endsOnHint")}
                error={errors.endsOn?.message}
              >
                <FieldControl>
                  <Input type="date" {...form.register("endsOn")} />
                </FieldControl>
              </Field>
            </div>
          )}
          {action === "CORRECT" && (
            <Field label={t("actionDialog.displayName")} error={errors.displayName?.message}>
              <FieldControl>
                <Input autoComplete="off" maxLength={200} {...form.register("displayName")} />
              </FieldControl>
            </Field>
          )}
          <Field
            label={t("actionDialog.reason")}
            description={t("actionDialog.reasonHint")}
            error={errors.reason?.message}
          >
            <FieldControl>
              <textarea
                rows={3}
                maxLength={2000}
                className={cn(inputClass, "h-auto min-h-24 py-3 leading-relaxed")}
                {...form.register("reason")}
              />
            </FieldControl>
          </Field>
          <Field
            label={t("actionDialog.reference")}
            description={t("actionDialog.referenceHint")}
            error={errors.reference?.message}
          >
            <FieldControl>
              <Input autoComplete="off" maxLength={80} {...form.register("reference")} />
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("actionDialog.cancel")}
            </Button>
            <Button
              type="submit"
              loading={pending}
              variant={action === "REVOKE" || action === "SUSPEND" ? "destructive" : "default"}
            >
              {checked ? t("actionDialog.submitForApproval") : t(`actions.${action}.submit`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
