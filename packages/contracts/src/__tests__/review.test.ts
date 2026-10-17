import { describe, expect, it } from "vitest";
import {
  bulkAssignSchema,
  correctDecisionSchema,
  decisionConditionSchema,
  decisionSchema,
  queueQuerySchema,
  reissueCertificateSchema,
} from "../review";

const ID = "6f1c2a52-3b5e-4c0e-9f4a-0c1d2e3f4a5b";

describe("queue query (FR-BO-001)", () => {
  it("accepts an officer id or 'none' and a known sort; ignores anything else", () => {
    expect(queueQuerySchema.parse({ officer: "none", sort: "stale" })).toMatchObject({
      officer: "none",
      sort: "stale",
    });
    expect(queueQuerySchema.parse({ officer: ID }).officer).toBe(ID);
    expect(queueQuerySchema.parse({ officer: "bob", sort: "random" })).toMatchObject({
      officer: undefined,
      sort: undefined,
    });
  });
});

describe("bulk assignment (FR-BO-005)", () => {
  it("needs at least one file and caps the batch", () => {
    expect(bulkAssignSchema.safeParse({ applicationIds: [], officerId: ID }).success).toBe(false);
    expect(
      bulkAssignSchema.safeParse({ applicationIds: Array(51).fill(ID), officerId: ID }).success,
    ).toBe(false);
    expect(bulkAssignSchema.safeParse({ applicationIds: [ID], officerId: ID }).success).toBe(true);
  });
});

describe("decisions (FR-M-009/011/017)", () => {
  it("conditions default to no evidence requirement", () => {
    expect(decisionConditionSchema.parse({ code: "REPORT_QUARTERLY" })).toMatchObject({
      publicOnRegister: true,
      evidenceRequired: false,
    });
  });

  it("takes an optional practice-arrangement override from the closed list", () => {
    const base = { applicationId: ID, decision: "APPROVED", password: "x" } as const;
    expect(decisionSchema.parse({ ...base, practiceArrangement: "INDEPENDENT" })).toMatchObject({
      practiceArrangement: "INDEPENDENT",
    });
    expect(decisionSchema.safeParse({ ...base, practiceArrangement: "FREELANCE" }).success).toBe(
      false,
    );
  });

  it("a correction needs a reason of at least 10 characters", () => {
    expect(correctDecisionSchema.safeParse({ decisionId: ID, reason: "typo" }).success).toBe(false);
    expect(
      correctDecisionSchema.safeParse({
        decisionId: ID,
        reason: "Correction of a clerical error",
      }).success,
    ).toBe(true);
  });
});

describe("certificate reissue (FR-N-012)", () => {
  it("needs a reason and the password", () => {
    expect(
      reissueCertificateSchema.safeParse({ licenceId: ID, reason: "Lost", password: "x" }).success,
    ).toBe(false);
    expect(
      reissueCertificateSchema.safeParse({
        licenceId: ID,
        reason: "Certificate reported lost",
        password: "",
      }).success,
    ).toBe(false);
  });
});
