import { describe, expect, it } from "vitest";
import { precheck, type PrecheckAnswers } from "../eligibility";
import { APPLICATION_STATUSES, APPLICATION_STATUS_TONES, journeyStageIndex } from "../status";

const person = (overrides: Partial<PrecheckAnswers> = {}): PrecheckAnswers => ({
  applicantType: "INDIVIDUAL",
  adult: true,
  education: "A2",
  licence: "NONE",
  years: 0,
  ...overrides,
});

/** FR-PORTAL-006 / SRS §3.2, table-driven. */
describe("eligibility pre-check", () => {
  it.each<[string, PrecheckAnswers, string | null]>([
    ["A2 newcomer → FSLA", person(), "FSLA"],
    ["no qualification → nothing", person({ education: "NONE" }), null],
    ["minor → nothing", person({ adult: false }), null],
    [
      "FSLA 3 yrs + A1 → REA",
      person({ education: "A1_OR_HIGHER", licence: "FSLA", years: 3 }),
      "REA",
    ],
    [
      "REA 4 yrs + degree → Broker",
      person({ education: "REAL_ESTATE_DEGREE", licence: "REA", years: 4 }),
      "BROKER",
    ],
    [
      "Broker → firm roles",
      person({ education: "REAL_ESTATE_DEGREE", licence: "BROKER", years: 1 }),
      "PRINCIPAL_BROKER",
    ],
    ["firm → REBF", person({ applicantType: "ORGANISATION" }), "REBF"],
  ])("%s", (_label, answers, expected) => {
    expect(precheck(answers).recommended).toBe(expected);
  });

  it("shows experience progress when only time is missing (persona Eric)", () => {
    const { next } = precheck(
      person({ education: "REAL_ESTATE_DEGREE", licence: "REA", years: 2 }),
    );
    expect(next).toMatchObject({
      category: "BROKER",
      status: "notYet",
      experience: { years: 2, required: 3 },
    });
  });

  it("marks education gaps as not eligible rather than not yet", () => {
    const rea = precheck(person({ licence: "FSLA", years: 5 })).results.find(
      (r) => r.category === "REA",
    );
    expect(rea).toMatchObject({ status: "notEligible", missing: ["education"] });
  });

  it("never offers individual categories to a firm", () => {
    const { results } = precheck(person({ applicantType: "ORGANISATION" }));
    expect(results.filter((r) => r.status === "eligible").map((r) => r.category)).toEqual(["REBF"]);
  });
});

describe("status tones", () => {
  it("covers every application status and maps each to a journey stage", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(APPLICATION_STATUS_TONES[status]).toBeDefined();
      expect(journeyStageIndex(status)).toBeGreaterThanOrEqual(0);
    }
  });
});
