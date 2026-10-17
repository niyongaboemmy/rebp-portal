"use client";

import { createContext, useContext } from "react";
import type { RuleResult, StepKey } from "@rebp/contracts";

/** Lets any part of the wizard move to another step (saving first), e.g. "Fix in Education". */
export const WizardNavContext = createContext<((step: StepKey) => void) | null>(null);

export function useWizardNav() {
  return useContext(WizardNavContext);
}

/**
 * Where a rule's answer is given, so a problem can link straight there. Rules name their field
 * ("f.supervisorLicenceNo"); the id ranges are the fallback for results stored before that.
 */
export function stepForRule(rule: Pick<RuleResult, "id" | "field">): StepKey | null {
  if (rule.field) return rule.field.split(".")[0] as StepKey;
  const n = Number(rule.id.replace("BR-", ""));
  if (n < 10) return "b";
  if (n < 15) return "c";
  if (n < 20) return "d";
  if (n < 30) return "e";
  if (n === 31) return "g";
  if (n < 40) return "f";
  if (n >= 60 && n < 70) return "h";
  if (n === 70) return "g";
  return null;
}

/** The rule's field inside its section ("supervisorLicenceNo"), or null for a whole-section rule. */
export function pathForRule(rule: Pick<RuleResult, "field">): string | null {
  const dot = rule.field?.indexOf(".") ?? -1;
  return dot > 0 ? rule.field!.slice(dot + 1) : null;
}
