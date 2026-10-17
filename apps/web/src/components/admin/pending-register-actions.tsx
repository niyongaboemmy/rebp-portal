"use client";

import { Check, Hourglass, ShieldAlert, X } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { LicenseStatus, RegisterAction } from "@rebp/contracts";
import { ATTENTION_DOT, LIST_GROUP, LIST_ROW } from "@/components/admin/surfaces";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
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
import { useErrorMessage } from "@/hooks/use-error-message";
import { formatDateTime, formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { decideRegisterActionAction } from "@/server/actions/backoffice";
import type { PendingRegisterRow } from "@/server/backoffice/admin-queries";

interface PendingRegisterActionsProps {
  rows: PendingRegisterRow[];
  canDecide: boolean;
  currentUserId: string;
}

/** Maker-checker queue for register changes (FR-RA-001): an approver applies or rejects. */
export function PendingRegisterActions({
  rows,
  canDecide,
  currentUserId,
}: PendingRegisterActionsProps) {
  const t = useTranslations("registerAdmin");
  const locale = useLocale();
  const [deciding, setDeciding] = useState<{ row: PendingRegisterRow; approve: boolean } | null>(
    null,
  );

  return (
    <>
      <ul className={LIST_GROUP} data-testid="pending-register-actions">
        {rows.map((row, index) => {
          const own = row.makerId === currentUserId;
          return (
            <li
              key={row.id}
              className={cn(
                "flex animate-rise flex-col gap-3 @xl/main:flex-row @xl/main:items-center",
                LIST_ROW,
                "py-3.5",
              )}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span
                className={cn(
                  "relative hidden size-10 shrink-0 items-center justify-center rounded-xl @md/main:inline-flex",
                  row.action === "REVOKE"
                    ? "bg-danger-soft text-destructive"
                    : "bg-primary-soft text-primary-soft-foreground",
                )}
              >
                <Hourglass className="size-5" aria-hidden />
                <span
                  aria-hidden
                  className={cn(ATTENTION_DOT, "absolute -top-0.5 -right-0.5 ring-2 ring-card")}
                />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span aria-hidden className={cn(ATTENTION_DOT, "@md/main:hidden")} />
                  <span className="font-semibold">
                    {t(`actions.${row.action as RegisterAction}.title`)}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {row.licence.licenceNo}
                  </span>
                  <LicenceStatusBadge status={row.licence.status as LicenseStatus} />
                </div>
                <p className="truncate text-sm font-medium">{row.licence.displayName}</p>
                <p className="text-sm break-words text-muted-foreground">{row.reason}</p>
                <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {t("detail.reference", { reference: row.reference })}
                  </span>
                  {row.payload.startsOn && (
                    <span>
                      {t("detail.from", { from: formatDay(row.payload.startsOn, locale) })}
                    </span>
                  )}
                  {row.payload.displayName && (
                    <span>{t("pending.newName", { name: row.payload.displayName })}</span>
                  )}
                  <span>
                    {t("pending.proposedBy", {
                      name: row.makerName ?? "—",
                      date: formatDateTime(row.createdAt, locale),
                    })}
                  </span>
                </p>
                {own && canDecide && (
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <ShieldAlert className="size-3.5 text-link" aria-hidden />{" "}
                    {t("pending.ownProposal")}
                  </p>
                )}
                {!canDecide && (
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("pending.awaiting")}
                  </p>
                )}
              </div>
              {canDecide && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={own}
                    onClick={() => setDeciding({ row, approve: false })}
                  >
                    <X /> {t("pending.reject")}
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={own}
                    onClick={() => setDeciding({ row, approve: true })}
                    data-testid={`approve-register-${row.licence.licenceNo}`}
                  >
                    <Check /> {t("pending.approve")}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {deciding && (
        <DecideDialog
          key={`${deciding.row.id}-${deciding.approve}`}
          row={deciding.row}
          approve={deciding.approve}
          onClose={() => setDeciding(null)}
        />
      )}
    </>
  );
}

function DecideDialog({
  row,
  approve,
  onClose,
}: {
  row: PendingRegisterRow;
  approve: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("registerAdmin");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await decideRegisterActionAction({
        id: row.id,
        approve,
        note: note.trim() || undefined,
      });
      if (!result.ok) {
        // Maker-checker (FR-RA-001): explain inline rather than a fleeting toast.
        if (result.error === "errors.makerChecker") return void setError(t("pending.makerChecker"));
        return void toast.error(errorMessage(result.error, result.meta));
      }
      toast.success(
        approve
          ? t("pending.approvedToast", { licence: row.licence.licenceNo })
          : t("pending.rejectedToast", { licence: row.licence.licenceNo }),
      );
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {approve ? t("pending.approveTitle") : t("pending.rejectTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("pending.decideDescription", {
              action: t(`actions.${row.action as RegisterAction}.title`),
              licence: row.licence.licenceNo,
            })}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="danger" title={t("pending.makerCheckerTitle")}>
            {error}
          </Alert>
        )}
        <Field label={t("pending.note")} description={t("pending.noteHint")}>
          <FieldControl>
            <textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={cn(inputClass, "h-auto min-h-24 py-3 leading-relaxed")}
            />
          </FieldControl>
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("actionDialog.cancel")}
          </Button>
          <Button
            variant={approve ? (row.action === "REVOKE" ? "destructive" : "default") : "outline"}
            loading={pending}
            onClick={confirm}
          >
            {approve ? t("pending.confirmApprove") : t("pending.confirmReject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
