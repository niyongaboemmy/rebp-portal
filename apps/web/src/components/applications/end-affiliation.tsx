"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserX } from "@/components/icons";
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
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { endAffiliationAction } from "@/server/actions/inbox";

/** FR-FIRM-005: end a practitioner's affiliation with an effective date and reason. */
export function EndAffiliationButton({ licenceId, name }: { licenceId: string; name: string }) {
  const t = useTranslations("firm.end");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      const result = await endAffiliationAction({ licenceId, effectiveOn: date, reason });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("done", { name }));
      setOpen(false);
      router.refresh();
    });
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <UserX aria-hidden /> {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title", { name })}</DialogTitle>
            <DialogDescription>{t("body")}</DialogDescription>
          </DialogHeader>
          <Field label={t("date")} error={errors.effectiveOn}>
            <FieldControl>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FieldControl>
          </Field>
          <Field label={t("reason")} error={errors.reason}>
            <FieldControl>
              <textarea
                rows={3}
                value={reason}
                maxLength={2000}
                onChange={(e) => setReason(e.target.value)}
                className={cn(inputClass, "h-auto py-3")}
              />
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={submit} loading={pending}>
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
