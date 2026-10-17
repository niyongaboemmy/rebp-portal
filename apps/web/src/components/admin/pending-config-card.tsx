"use client";

import { ArrowRight, Check, Hourglass, ShieldAlert, X } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useStepUp } from "@/components/security/step-up";
import { ATTENTION_DOT, ICON_TILE, LIST_GROUP, LIST_ROW } from "@/components/admin/surfaces";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldControl } from "@/components/ui/field";
import { inputClass } from "@/components/ui/input";
import { PANEL } from "@/components/ui/surface";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { decideConfigAction } from "@/server/actions/backoffice";

export interface ConfigDiffRow {
  key: string;
  label: string;
  before: string;
  after: string;
}

interface PendingConfigCardProps {
  id: string;
  version: number;
  /** Pre-formatted texts (server-side, in the reader's language). */
  effectiveLabel: string;
  makerLine: string;
  reason: string;
  diff: ConfigDiffRow[];
  canApprove: boolean;
  isOwn: boolean;
}

/**
 * A proposed configuration version awaiting approval (FR-ADM-003): what changes against the value
 * in force, and approve/reject for a checker who is not the maker (step-up required).
 */
export function PendingConfigCard({
  id,
  version,
  effectiveLabel,
  makerLine,
  reason,
  diff,
  canApprove,
  isOwn,
}: PendingConfigCardProps) {
  const t = useTranslations("configuration.pending");
  const router = useRouter();
  const stepUp = useStepUp();
  const errorMessage = useErrorMessage();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (approve: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await stepUp(() =>
        decideConfigAction({ id, approve, note: note.trim() || undefined }),
      );
      if (!result.ok) {
        if (result.error === "errors.makerChecker") return void setError(t("makerChecker"));
        return void toast.error(errorMessage(result.error, result.meta));
      }
      toast.success(approve ? t("approvedToast", { version }) : t("rejectedToast", { version }));
      router.refresh();
    });

  const needsYou = canApprove && !isOwn;

  return (
    <section
      aria-labelledby="pending-config-title"
      className={cn("flex animate-rise flex-col gap-4", PANEL)}
      data-testid="pending-config"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn(ICON_TILE, "relative")} aria-hidden>
          <Hourglass />
          <span className={cn(ATTENTION_DOT, "absolute -top-0.5 -right-0.5 ring-2 ring-card")} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[0.7rem] font-bold tracking-widest text-link uppercase">
            {needsYou ? t("needsYou") : t("badge")}
          </span>
          <h2 id="pending-config-title" className="text-lg">
            {t("title", { version })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {effectiveLabel} · {makerLine}
          </p>
        </div>
      </div>

      <p className="rounded-2xl bg-primary/[0.04] px-4 py-3 text-sm break-words dark:bg-white/[0.03]">
        {reason}
      </p>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("changes", { count: diff.length })}</h3>
        {diff.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noChanges")}</p>
        ) : (
          <ul className={LIST_GROUP}>
            {diff.map((row) => (
              <li
                key={row.key}
                className={cn(
                  "flex flex-col gap-1 text-sm @xl/main:flex-row @xl/main:items-center @xl/main:gap-3",
                  LIST_ROW,
                )}
              >
                <span className="min-w-0 flex-1 font-medium">{row.label}</span>
                <span className="inline-flex flex-wrap items-center gap-2 num">
                  <span className="text-muted-foreground line-through">
                    <span className="sr-only">{t("before")} </span>
                    {row.before}
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="rounded-md bg-primary-soft px-1.5 font-semibold text-link">
                    <span className="sr-only">{t("after")} </span>
                    {row.after}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <Alert variant="danger" title={t("makerCheckerTitle")}>
          {error}
        </Alert>
      )}

      {canApprove &&
        (isOwn ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <ShieldAlert className="size-4 text-link" aria-hidden /> {t("ownProposal")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label={t("note")} description={t("noteHint")}>
              <FieldControl>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={cn(inputClass, "h-auto min-h-20 py-3 leading-relaxed")}
                />
              </FieldControl>
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={pending}
                onClick={() => decide(false)}
              >
                <X /> {t("reject")}
              </Button>
              <Button
                className="rounded-full"
                loading={pending}
                onClick={() => decide(true)}
                data-testid="approve-config"
              >
                <Check /> {t("approve")}
              </Button>
            </div>
          </div>
        ))}
      {!canApprove && <p className="text-sm text-muted-foreground">{t("waiting")}</p>}
    </section>
  );
}
