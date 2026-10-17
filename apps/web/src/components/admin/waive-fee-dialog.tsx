"use client";

import { Money } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { waiverSchema } from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { inputClass } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { cn } from "@/lib/utils";
import { waiveFeeAction } from "@/server/actions/backoffice";

/** FR-PAY-008: Finance waives an application's fee, with a recorded reason. */
export function WaiveFeeDialog({
  applicationId,
  referenceNo,
  amountLabel,
}: {
  applicationId: string;
  referenceNo: string;
  /** Already formatted (formatMoney). */
  amountLabel: string;
}) {
  const t = useTranslations("finance.waive");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, submit, pending } = useActionForm({
    schema: waiverSchema,
    defaultValues: { applicationId, reason: "" },
    action: waiveFeeAction,
    successMessage: t("done", { reference: referenceNo }),
    onSuccess: () => {
      setOpen(false);
      form.reset();
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="tonal" data-testid={`waive-${referenceNo}`}>
          <Money /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { reference: referenceNo, amount: amountLabel })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field
            label={t("reason")}
            description={t("reasonHint")}
            error={form.formState.errors.reason?.message}
          >
            <FieldControl>
              <textarea
                rows={3}
                maxLength={500}
                className={cn(inputClass, "h-auto min-h-24 py-3 leading-relaxed")}
                {...form.register("reason")}
              />
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
