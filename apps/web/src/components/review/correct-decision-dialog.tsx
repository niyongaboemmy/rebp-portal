"use client";

import { PenLine } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { correctDecisionSchema } from "@rebp/contracts";
import { Alert } from "@/components/ui/alert";
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
import { correctDecisionAction } from "@/server/actions/backoffice";

/**
 * FR-M-017: decisions are immutable, so a clerical error is fixed by a new decision linked to
 * the original, with a reason, the corrected wording and a new letter — confirmed in the
 * approver's two-step-verified session (FR-M-013). The outcome itself never changes here.
 */
export function CorrectDecisionDialog({
  decisionId,
  letterNo,
  reasons,
}: {
  decisionId: string;
  letterNo: string;
  reasons: string | null;
}) {
  const t = useTranslations("decide.correct");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, submit, pending } = useActionForm({
    schema: correctDecisionSchema,
    defaultValues: { decisionId, reason: "", reasons: reasons ?? "" },
    action: (values) =>
      correctDecisionAction({ ...values, reasons: values.reasons?.trim() || undefined }),
    onSuccess: (data) => {
      setOpen(false);
      form.reset({ decisionId, reason: "", reasons: reasons ?? "" });
      toast.success(t("done", { letter: data.letterNo }));
      router.refresh();
    },
  });
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="self-start" data-testid="correct-decision">
          <PenLine /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { letter: letterNo })}</DialogDescription>
        </DialogHeader>
        <Alert variant="info">{t("immutableNote")}</Alert>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field label={t("reason")} description={t("reasonHint")} error={errors.reason?.message}>
            <FieldControl>
              <textarea
                rows={2}
                maxLength={2000}
                {...form.register("reason")}
                className={cn(inputClass, "h-auto py-3")}
              />
            </FieldControl>
          </Field>
          <Field
            label={t("reasons")}
            description={t("reasonsHint")}
            error={errors.reasons?.message}
          >
            <FieldControl>
              <textarea
                rows={4}
                maxLength={2000}
                {...form.register("reasons")}
                className={cn(inputClass, "h-auto py-3")}
              />
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button type="submit" loading={pending} data-testid="correct-decision-submit">
              <PenLine /> {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
