"use client";

import { useTranslations } from "next-intl";
import { buildChecklist, DOCUMENT_RULES, isRequiredForSubmission } from "@rebp/contracts";
import { useWizard } from "./context";
import { DocumentSlot } from "./document-slot";
import { FieldGroup } from "./fields";

/**
 * The uploads that belong to a step, taken from the live checklist (FR-I-001): answering "Yes" to
 * a foreign qualification immediately adds the recognition slot here and on the checklist.
 */
export function StepDocuments({ step }: { step: string }) {
  const t = useTranslations("wizard.documents");
  const { application, data, stepDocuments } = useWizard();
  // The CV shows its own evidence (UX-018); an application, its live checklist.
  const items = stepDocuments
    ? stepDocuments(step).map((type) => ({ type, requirement: "C" as const, condition: undefined }))
    : buildChecklist({
        type: application.type,
        category: application.category,
        data,
      }).filter((item) => DOCUMENT_RULES[item.type].step === step);
  if (items.length === 0) return null;
  return (
    <FieldGroup title={t("stepTitle")} description={t("stepHint")}>
      <div className="grid grid-cols-1 gap-3 @2xl/form:grid-cols-2">
        {items.map((item) => (
          <DocumentSlot
            key={item.type}
            type={item.type}
            // The CV's evidence is optional there (UX-018): a symbol, not a yellow card (UX-024).
            required={!stepDocuments && isRequiredForSubmission(item)}
          />
        ))}
      </div>
    </FieldGroup>
  );
}
