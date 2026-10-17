import { describe, expect, it } from "vitest";
import type { RuleResult, StepKey } from "@rebp/contracts";
import { failingByStep, furthestReached, journeyOf, rulesOnStep, stepStateOf } from "../state";

/** UX-004 §3.3: one source of truth for where the applicant stands. */
const STEPS: StepKey[] = ["a", "b", "c", "d", "f", "h", "i", "review"];
const rule = (id: string, outcome: RuleResult["outcome"], field?: string): RuleResult => ({
  id,
  outcome,
  message: `${id}.x`,
  ...(field ? { field } : {}),
  ...(outcome === "NEEDS_ASSESSMENT" ? { action: { kind: "none" as const } } : {}),
});

describe("furthestReached", () => {
  it("is the current step when later steps are empty", () => {
    expect(furthestReached(STEPS, "c", { b: { surname: "A" } })).toBe(2);
  });
  it("counts a later step that already has answers", () => {
    expect(furthestReached(STEPS, "c", { h: { codeOfConduct: true } })).toBe(5);
  });
  it("ignores an empty later section", () => {
    expect(furthestReached(STEPS, "b", { h: {} })).toBe(1);
  });
});

describe("journeyOf", () => {
  const rules = [
    rule("BR-001", "PASS", "b.dateOfBirth"),
    rule("BR-030", "FAIL", "f.supervisorLicenceNo"),
    rule("BR-061", "FAIL", "h.criminalRecordIssuedOn"),
    rule("BR-012", "WARN", "c.qualifications"),
    rule("BR-035", "NEEDS_ASSESSMENT", "f.firmId"),
    rule("BR-040", "FAIL"),
  ];

  it("doesn't fail a step the applicant hasn't reached", () => {
    const journey = journeyOf(rules, STEPS, STEPS.indexOf("f"));
    expect(journey.toFix.map((r) => r.id)).toEqual(["BR-030", "BR-040"]);
    expect(journey.upcoming.map((r) => r.id)).toEqual(["BR-061"]);
  });

  it("separates notes and officer checks from things to fix", () => {
    const journey = journeyOf(rules, STEPS, STEPS.indexOf("h"));
    expect(journey.toFix.map((r) => r.id)).toEqual(["BR-030", "BR-061", "BR-040"]);
    expect(journey.notes.map((r) => r.id)).toEqual(["BR-012"]);
    expect(journey.officer.map((r) => r.id)).toEqual(["BR-035"]);
  });

  it("counts failures per step", () => {
    const counts = failingByStep(journeyOf(rules, STEPS, STEPS.length));
    expect(counts.get("f")).toBe(1);
    expect(counts.get("h")).toBe(1);
    expect(counts.has("c")).toBe(false);
  });

  it("lists every non-pass rule of one step", () => {
    expect(rulesOnStep(rules, "f").map((r) => r.id)).toEqual(["BR-030", "BR-035"]);
  });
});

describe("stepStateOf", () => {
  const base = {
    step: "f" as StepKey,
    issues: 0,
    attempted: false,
    hasAnswers: true,
    failing: false,
    locked: false,
    checklistDone: false,
  };
  it.each([
    [{}, "complete"],
    [{ failing: true }, "blocked"],
    [{ issues: 2 }, "inProgress"],
    [{ issues: 2, attempted: true }, "errors"],
    [{ issues: 2, hasAnswers: false }, "notStarted"],
    [{ locked: true, failing: true }, "locked"],
    [{ step: "i" as StepKey, checklistDone: true }, "complete"],
    [{ step: "review" as StepKey }, "notStarted"],
  ])("%o → %s", (over, expected) => {
    expect(stepStateOf({ ...base, ...over })).toBe(expected);
  });
});
