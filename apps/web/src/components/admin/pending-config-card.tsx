"use client";

import { ArrowRight, Check, Hourglass, ShieldAlert, X } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useStepUp } from "@/components/security/step-up";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldControl } from "@/components/ui/field";
import { inputClass } from "@/components/ui/input";
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

  return (
    <section
      aria-labelledby="pending-config-title"
      className="flex animate-rise flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
      data-testid="pending-config"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="text-warning-strong inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft">
          <Hourglass className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pending-config-title" className="text-lg">
              {t("title", { version })}
            </h2>
            <Badge variant="warning">{t("badge")}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {effectiveLabel} · {makerLine}
          </p>
        </div>
      </div>

      <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm break-words">{reason}</p>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("changes", { count: diff.length })}</h3>
        {diff.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noChanges")}</p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl border">
            {diff.map((row) => (
              <li
                key={row.key}
                className="flex flex-col gap-1 border-b px-4 py-2.5 text-sm last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="min-w-0 flex-1 font-medium">{row.label}</span>
                <span className="inline-flex flex-wrap items-center gap-2 num">
                  <span className="text-muted-foreground line-through">
                    <span className="sr-only">{t("before")} </span>
                    {row.before}
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="font-semibold text-primary">
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
          <p className="text-warning-strong inline-flex items-center gap-1.5 text-sm font-semibold">
            <ShieldAlert className="size-4" aria-hidden /> {t("ownProposal")}
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
              <Button variant="outline" disabled={pending} onClick={() => decide(false)}>
                <X /> {t("reject")}
              </Button>
              <Button loading={pending} onClick={() => decide(true)} data-testid="approve-config">
                <Check /> {t("approve")}
              </Button>
            </div>
          </div>
        ))}
      {!canApprove && <p className="text-sm text-muted-foreground">{t("waiting")}</p>}
    </section>
  );
}
