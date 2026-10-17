"use client";

import { ArrowRight } from "@/components/icons";
import { useTranslations } from "next-intl";
import { DOCUMENT_RULES, isCvSection, type RuleResult, type StepKey } from "@rebp/contracts";
import { useRouter } from "next/navigation";
import { useWizard } from "./context";
import { cvHref } from "./cv-link";
import { focusDocument, focusField } from "./focus";
import { pathForRule, stepForRule, useWizardNav } from "./nav";

/**
 * Where a rule is fixed and how to get there (UX-004 §3.1, UX-019): the step, a label for the way
 * ("Fix this", "Fix in Education", "Replace document") and the action; null for officer-only rules.
 */
export function useRuleFix(rule: RuleResult, current?: StepKey) {
  const t = useTranslations("wizard");
  const go = useWizardNav();
  const router = useRouter();
  const { application } = useWizard();
  const action = rule.action ?? { kind: "goToField" as const };
  if (action.kind === "none" || !go) return null;

  const document = action.kind === "replaceDocument" ? action.documentType : null;
  const step: StepKey | null = document
    ? (DOCUMENT_RULES[document].step as StepKey)
    : stepForRule(rule);
  if (!step) return null;
  const path = pathForRule(rule);
  const here = step === current;
  // On its own step, a rule about the whole section has nowhere more specific to go.
  if (here && !document && !path && !isCvSection(step)) return null;

  // An individual's education, training and experience are edited in their CV (UX-021).
  const inCv =
    !document &&
    isCvSection(step) &&
    application.accountType === "INDIVIDUAL" &&
    application.category !== "REBF" &&
    application.id !== "cv";
  const run = () => {
    if (inCv) return router.push(cvHref(application.id, step, path ? { focus: path } : {}));
    if (!here) go(step);
    if (document) focusDocument(document);
    else if (path) focusField(path);
  };
  const label = document
    ? here
      ? t("ruleAction.replace")
      : t("ruleAction.replaceIn", { step: t(`steps.${step}.title`) })
    : here
      ? t("ruleAction.fix")
      : t("fixIn", { step: t(`steps.${step}.title`) });
  return { run, label, step, here, document };
}

/**
 * The one-tap fix under a rule that needs work (UX-004 §3.1): "Fix this" focuses the answer on
 * this step; "Fix in Education →" moves there first (saving), then focuses it; "Replace
 * document" opens the upload. Officer-only rules (`action.kind === "none"`) get no button.
 */
export function FixLink({ rule, current }: { rule: RuleResult; current?: StepKey }) {
  const fix = useRuleFix(rule, current);
  if (!fix) return null;
  return (
    <button
      type="button"
      onClick={fix.run}
      className="group inline-flex min-h-8 w-fit items-center gap-1 rounded-full px-1 text-xs font-semibold text-link underline-offset-4 hover:underline"
    >
      {fix.label}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
