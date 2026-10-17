"use client";

import { Check, Hourglass, ShieldAlert, X } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { LicenseStatus, RegisterAction } from "@rebp/contracts";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
      <ul className="flex flex-col gap-2.5" data-testid="pending-register-actions">
        {rows.map((row, index) => {
          const own = row.makerId === currentUserId;
          return (
            <li
              key={row.id}
              className="flex animate-rise flex-col gap-3 rounded-2xl border bg-card p-4 raised sm:flex-row sm:items-start"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span className="text-warning-strong inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft">
                <Hourglass className="size-5" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">
                    {t(`actions.${row.action as RegisterAction}.title`)}
                  </span>
                  <Badge variant="warning">{t("pending.awaiting")}</Badge>
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-mono">{row.licence.licenceNo}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="min-w-0 truncate">{row.licence.displayName}</span>
                  <LicenceStatusBadge status={row.licence.status as LicenseStatus} />
                </p>
                <p className="text-sm break-words text-foreground/80">{row.reason}</p>
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
                  <p className="text-warning-strong inline-flex items-center gap-1.5 text-xs font-semibold">
                    <ShieldAlert className="size-3.5" aria-hidden /> {t("pending.ownProposal")}
                  </p>
                )}
              </div>
              {canDecide && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={own}
                    onClick={() => setDeciding({ row, approve: false })}
                  >
                    <X /> {t("pending.reject")}
                  </Button>
                  <Button
                    size="sm"
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
