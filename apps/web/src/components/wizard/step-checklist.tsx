"use client";

import { useTranslations } from "next-intl";
import {
  buildChecklist,
  checklistStatus,
  isRequiredForSubmission,
  isSatisfied,
} from "@rebp/contracts";
import { CircleCheck } from "@/components/icons";
import { ProgressRing } from "@/components/data/progress-ring";
import { useWizard } from "./context";
import { DocumentSlot } from "./document-slot";

/**
 * Step I — the dynamic document checklist (FR-I-001…005): every required and conditional item with
 * its live status, the reason a conditional item applies, and an upload slot. Proof of payment is
 * automatic (FR-I-004); officer-named documents appear as "Other" (FR-I-005).
 */
export function StepChecklist() {
  const t = useTranslations("wizard.checklist");
  const { application, data, documents } = useWizard();
  const items = buildChecklist({ type: application.type, category: application.category, data });
  if (application.extraDocuments.length > 0)
    items.push({ type: "other", requirement: "C", condition: "authority" });
  const rows = items.map((item) => {
    const statuses = documents.filter((d) => d.type === item.type).map((d) => d.status);
    return {
      item,
      required: isRequiredForSubmission(item),
      done: isSatisfied(statuses),
      status: checklistStatus(statuses),
    };
  });
  const required = rows.filter((r) => r.required);
  const done = required.filter((r) => r.done).length;
  // What's still missing comes first (UX-024).
  rows.sort((a, b) => Number(!a.required || a.done) - Number(!b.required || b.done));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]">
        <ProgressRing
          value={done}
          total={Math.max(1, required.length)}
          tone={done === required.length ? "good" : undefined}
          className="size-14"
          label={t("progress", { done, total: required.length })}
        >
          <span className="text-sm font-bold num">
            {done}/{required.length}
          </span>
        </ProgressRing>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">
            {done === required.length ? t("complete") : t("incomplete")}
          </span>
          <span className="text-sm text-muted-foreground">{t("hint")}</span>
        </div>
      </div>

      {application.extraDocuments.length > 0 && (
        <div className="rounded-2xl bg-primary-soft p-4 text-sm">
          <span className="font-semibold">{t("extraTitle")}</span>
          <ul className="mt-1 list-disc pl-5">
            {application.extraDocuments.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Two columns when there's room (UX-008); each slot says its own state and reason. */}
      <ol className="grid grid-cols-1 gap-3 @2xl/form:grid-cols-2">
        {rows.map(({ item, required: req }) => (
          <li key={item.type}>
            <DocumentSlot
              type={item.type}
              required={req}
              reason={item.condition ? t(`conditions.${item.condition}`) : undefined}
              compact
            />
          </li>
        ))}
        <li className="flex items-center gap-3 rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/[0.06] @2xl/form:col-span-2 dark:bg-surface-2/70 dark:ring-white/[0.06]">
          <CircleCheck className="size-4 text-link" aria-hidden />
          {t("paymentAuto")}
        </li>
      </ol>
    </div>
  );
}
