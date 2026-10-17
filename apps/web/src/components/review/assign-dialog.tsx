"use client";

import { UserCog, UserPlus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { assignSchema } from "@rebp/contracts";
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
import { assignAction } from "@/server/actions/backoffice";

export interface OfficerOption {
  id: string;
  fullName: string;
}

/**
 * Assign / reassign (FR-BO-002). The server re-checks the conflict-of-interest guard (BR-093) and
 * names the reason; it is shown in the dialog rather than as a fleeting toast.
 */
export function AssignDialog({
  applicationId,
  reference,
  currentOfficerId,
  officers,
  selfId,
  compact = false,
}: {
  applicationId: string;
  reference: string;
  currentOfficerId: string | null;
  officers: OfficerOption[];
  selfId: string;
  compact?: boolean;
}) {
  const t = useTranslations("queue.assign");
  const tq = useTranslations("queue");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [conflict, setConflict] = useState<string[] | null>(null);
  const defaultOfficer =
    currentOfficerId ?? (officers.some((o) => o.id === selfId) ? selfId : (officers[0]?.id ?? ""));
  const { form, submit, pending } = useActionForm({
    schema: assignSchema,
    defaultValues: { applicationId, officerId: defaultOfficer },
    action: assignAction,
    successMessage: t("done", { reference }),
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: (result) => {
      if (result.error !== "errors.conflictOfInterest") return false;
      setConflict(
        String(result.meta?.reasons ?? "")
          .split(",")
          .filter(Boolean),
      );
      return true;
    },
  });
  const label = currentOfficerId ? t("reassign") : t("assign");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConflict(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`${label} — ${reference}`}>
          {currentOfficerId ? <UserCog /> : <UserPlus />}
          <span className={cn(compact && "sr-only sm:not-sr-only")}>{label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{t("description", { reference })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          {conflict && (
            <Alert variant="danger" title={t("conflictTitle")}>
              <ul className="list-disc pl-4">
                {conflict.map((reason) => (
                  <li key={reason}>{tq(`conflictReasons.${reason}`)}</li>
                ))}
              </ul>
            </Alert>
          )}
          <Field label={t("officer")} error={form.formState.errors.officerId?.message}>
            <FieldControl>
              <select
                {...form.register("officerId", { onChange: () => setConflict(null) })}
                className={cn(inputClass, "bg-card dark:bg-transparent")}
              >
                {officers.map((officer) => (
                  <option key={officer.id} value={officer.id}>
                    {officer.id === selfId ? t("me", { name: officer.fullName }) : officer.fullName}
                    {officer.id === currentOfficerId ? ` · ${t("current")}` : ""}
                  </option>
                ))}
              </select>
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button type="submit" loading={pending} disabled={officers.length === 0}>
              {label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
