import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/server/env";
import { mfaBlocks, mfaRecommended } from "../mfa-policy";

// FR-ACC-004 (ADR-004 amendment 2026-10-17): optional by default, enforceable with MFA_ENFORCE.
const staff = { roles: ["REVIEWING_OFFICER" as const], mfaMethods: [] as string[] };
const applicant = { roles: ["APPLICANT" as const], mfaMethods: [] as string[] };

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

const withEnforce = (value: string) => {
  vi.stubEnv("MFA_ENFORCE", value);
  resetEnvCache();
};

describe("mfaBlocks", () => {
  it("lets staff without two-step through when it is optional (the default)", () => {
    withEnforce("false");
    expect(mfaBlocks(staff, { mfaVerified: false })).toBe(false);
    expect(mfaRecommended(staff)).toBe(true);
  });

  it("blocks staff without two-step when enforced", () => {
    withEnforce("true");
    expect(mfaBlocks(staff, { mfaVerified: false })).toBe(true);
  });

  it("never lets someone who has two-step skip it this session", () => {
    withEnforce("false");
    const enrolled = { ...staff, mfaMethods: ["EMAIL"] };
    expect(mfaBlocks(enrolled, { mfaVerified: false })).toBe(true);
    expect(mfaBlocks(enrolled, { mfaVerified: true })).toBe(false);
  });

  it("does not ask applicants for it", () => {
    withEnforce("true");
    expect(mfaBlocks(applicant, { mfaVerified: false })).toBe(false);
    expect(mfaRecommended(applicant)).toBe(false);
  });
});
