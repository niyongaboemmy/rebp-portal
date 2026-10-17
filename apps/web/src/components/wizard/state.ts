import type { ApplicationData, RuleResult, StepKey } from "@rebp/contracts";
import { stepForRule } from "./nav";

/**
 * Where the applicant stands, as one set of pure functions (UX-004 §3.3) so the rail, the mobile
 * header, the step badge and the issue list can never disagree (UX-003 F4).
 */

export type StepState = "complete" | "inProgress" | "errors" | "blocked" | "notStarted" | "locked";

/**
 * The furthest step the applicant has reached: the current one, or a later one that already has
 * answers (a resumed or re-opened application). A rule about a step not reached yet is
 * "upcoming", never a failure: the applicant hasn't been asked yet (UX-003 §6.2).
 */
export function furthestReached(
  steps: readonly StepKey[],
  current: StepKey,
  data: ApplicationData,
): number {
  let furthest = steps.indexOf(current);
  steps.forEach((step, i) => {
    const answers = data[step as keyof ApplicationData];
    if (answers && typeof answers === "object" && Object.keys(answers).length > 0)
      furthest = Math.max(furthest, i);
  });
  return furthest;
}

export interface Journey {
  /** Failing rules on steps already reached: the applicant should act. */
  toFix: RuleResult[];
  /** Warnings on reached steps: worth reading, not blocking. */
  notes: RuleResult[];
  /** An officer decides; nothing to do. */
  officer: RuleResult[];
  /** Failing rules on steps not reached yet. */
  upcoming: RuleResult[];
}

export function journeyOf(
  rules: readonly RuleResult[],
  steps: readonly StepKey[],
  reached: number,
): Journey {
  const journey: Journey = { toFix: [], notes: [], officer: [], upcoming: [] };
  for (const rule of rules) {
    if (rule.outcome === "PASS") continue;
    if (rule.outcome === "NEEDS_ASSESSMENT" || rule.action?.kind === "none") {
      journey.officer.push(rule);
      continue;
    }
    const step = stepForRule(rule);
    const index = step ? steps.indexOf(step) : -1;
    // Rules about the whole application (renewal, upgrade) are always "reached".
    const isReached = index < 0 || index <= reached;
    if (!isReached) journey.upcoming.push(rule);
    else if (rule.outcome === "FAIL") journey.toFix.push(rule);
    else journey.notes.push(rule);
  }
  return journey;
}

/** Failing rules per step, counted only for steps reached. */
export function failingByStep(journey: Journey): Map<StepKey, number> {
  const counts = new Map<StepKey, number>();
  for (const rule of journey.toFix) {
    const step = stepForRule(rule);
    if (step) counts.set(step, (counts.get(step) ?? 0) + 1);
  }
  return counts;
}

/** The rules shown on a step (any outcome but PASS), whatever their status in the journey. */
export function rulesOnStep(rules: readonly RuleResult[], step: StepKey): RuleResult[] {
  return rules.filter((rule) => rule.outcome !== "PASS" && stepForRule(rule) === step);
}

export function stepStateOf(input: {
  step: StepKey;
  issues: number;
  attempted: boolean;
  hasAnswers: boolean;
  failing: boolean;
  locked: boolean;
  checklistDone: boolean;
}): StepState {
  const { step } = input;
  if (step === "a") return "complete";
  if (step === "review") return "notStarted";
  if (step === "i") return input.checklistDone ? "complete" : "inProgress";
  if (input.locked) return "locked";
  // Answered, but the answers fail a rule (e.g. the supervisor's category): needs fixing.
  if (input.issues === 0) return input.failing ? "blocked" : "complete";
  if (input.attempted) return "errors";
  return input.hasAnswers ? "inProgress" : "notStarted";
}
