"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CONFIRMATION_STATUS_TONES,
  type Category,
  type ConfirmationKind,
  type ConfirmationStatus,
} from "@rebp/contracts";
import { Check, UserCheck, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { inputClass } from "@/components/ui/input";
import { useErrorMessage } from "@/hooks/use-error-message";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { respondConfirmationsAction } from "@/server/actions/inbox";

export interface InboxItem {
  id: string;
  kind: ConfirmationKind;
  status: ConfirmationStatus;
  reason: string | null;
  createdAt: string;
  dueAt: string;
  reference: string;
  category: Category;
  applicant: string;
  firm: string | null;
  affiliationStart: string | null;
}

/** Pending requests with select-all for bulk confirmation (FR-FIRM-003); answered ones below. */
export function ConfirmationInbox({
  items,
  locale,
  focus,
}: {
  items: InboxItem[];
  locale: string;
  focus?: string;
}) {
  const t = useTranslations("confirmations");
  const tc = useTranslations("categories.items");
  const ts = useTranslations("status.confirmation");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pending = items.filter((i) => i.status === "PENDING");
  const answered = items.filter((i) => i.status !== "PENDING");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(focus && pending.some((p) => p.id === focus) ? [focus] : []),
  );
  const [declining, setDeclining] = useState<string[] | null>(null);
  const [reason, setReason] = useState("");
  const [busy, startTransition] = useTransition();

  const respond = (ids: string[], confirm: boolean, why?: string) =>
    startTransition(async () => {
      const result = await respondConfirmationsAction({ ids, confirm, reason: why });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(confirm ? t("confirmedToast", { count: ids.length }) : t("declinedToast"));
      setSelected(new Set());
      setDeclining(null);
      setReason("");
      router.refresh();
    });

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 && (
        <section aria-labelledby="pending-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="pending-title" className="text-lg">
              {t("pending", { count: pending.length })}
            </h2>
            {pending.length > 1 && (
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={selected.size === pending.length}
                  onCheckedChange={(v) =>
                    setSelected(v === true ? new Set(pending.map((p) => p.id)) : new Set())
                  }
                />
                {t("selectAll")}
              </label>
            )}
          </div>
          <ul className="flex flex-col gap-3">
            {pending.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:flex-row sm:items-center",
                  item.id === focus && "border-primary",
                )}
              >
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={(v) => toggle(item.id, v === true)}
                  aria-label={t("select", { name: item.applicant })}
                />
                <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground sm:inline-flex">
                  <UserCheck className="size-5" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-semibold">{item.applicant}</span>
                  <span className="text-sm text-muted-foreground">
                    {t(`kinds.${item.kind}`, { category: tc(`${item.category}.name`) })}
                    {item.firm && ` · ${item.firm}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono">{item.reference}</span> ·{" "}
                    {t("dueBy", { date: formatDay(item.dueAt, locale) })}
                    {item.affiliationStart &&
                      ` · ${t("from", { date: formatDay(item.affiliationStart, locale) })}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeclining([item.id])}
                    disabled={busy}
                  >
                    <X aria-hidden /> {t("decline")}
                  </Button>
                  <Button size="sm" onClick={() => respond([item.id], true)} disabled={busy}>
                    <Check aria-hidden /> {t("confirm")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {selected.size > 1 && (
            <div className="sticky bottom-20 z-10 flex animate-rise items-center justify-between gap-3 rounded-2xl bg-foreground p-3 pl-5 text-background lg:bottom-4">
              <span className="text-sm font-semibold">
                {t("selected", { count: selected.size })}
              </span>
              <Button
                size="sm"
                className="bg-background text-foreground hover:bg-background/90"
                onClick={() => respond([...selected], true)}
                loading={busy}
              >
                <Check aria-hidden /> {t("confirmSelected", { count: selected.size })}
              </Button>
            </div>
          )}
        </section>
      )}

      {answered.length > 0 && (
        <section aria-labelledby="answered-title" className="flex flex-col gap-3">
          <h2 id="answered-title" className="text-lg">
            {t("answered")}
          </h2>
          <ul className="flex flex-col gap-2">
            {answered.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-card/70 px-4 py-3"
              >
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{item.applicant}</span> ·{" "}
                  <span className="font-mono text-xs">{item.reference}</span>
                </span>
                <StatusBadge
                  tone={CONFIRMATION_STATUS_TONES[item.status]}
                  label={ts(item.status)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={declining !== null} onOpenChange={(open) => !open && setDeclining(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("declineTitle")}</DialogTitle>
            <DialogDescription>{t("declineBody")}</DialogDescription>
          </DialogHeader>
          <Field label={t("reason")}>
            <FieldControl>
              <textarea
                rows={3}
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                className={cn(inputClass, "h-auto py-3")}
              />
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 5}
              loading={busy}
              onClick={() => declining && respond(declining, false, reason)}
            >
              {t("declineConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
