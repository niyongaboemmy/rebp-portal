import { describe, expect, it } from "vitest";
import {
  can,
  idleTimeoutMinutes,
  isStaff,
  requiresMfa,
  ROLES,
  type Capability,
  type Role,
} from "../roles";

describe("permission matrix (SRS Appendix D)", () => {
  const cases: Array<[Role, Capability, boolean]> = [
    ["APPLICANT", "application.edit", true],
    ["APPLICANT", "review.perform", false],
    ["APPLICANT", "backoffice.access", false],
    ["SUPERVISOR", "confirmation.decide", true],
    ["REVIEWING_OFFICER", "review.perform", true],
    ["REVIEWING_OFFICER", "decision.make", false],
    ["APPROVING_AUTHORITY", "decision.make", true],
    ["APPROVING_AUTHORITY", "review.perform", false],
    ["REGISTRAR", "register.administer", true],
    ["FINANCE_OFFICER", "payments.manage", true],
    ["FINANCE_OFFICER", "audit.export", false],
    ["SYSTEM_ADMIN", "users.manage", true],
    ["AUDITOR", "audit.export", true],
    ["AUDITOR", "config.edit", false],
  ];

  it.each(cases)("%s → %s = %s", (role, capability, expected) => {
    expect(can([role], capability)).toBe(expected);
  });

  it("grants a capability when any held role allows it", () => {
    expect(can(["APPLICANT", "SUPERVISOR"], "confirmation.decide")).toBe(true);
  });

  it("keeps review and decision with different roles (segregation of duties)", () => {
    for (const role of ROLES) {
      expect(can([role], "review.perform") && can([role], "decision.make")).toBe(false);
    }
  });
});

describe("staff policies", () => {
  it("classifies staff roles", () => {
    expect(isStaff(["REVIEWING_OFFICER"])).toBe(true);
    expect(isStaff(["APPLICANT", "PRINCIPAL_BROKER"])).toBe(false);
  });

  it("requires MFA for staff and Principal Brokers only (FR-ACC-004)", () => {
    expect(requiresMfa(["APPLICANT"])).toBe(false);
    expect(requiresMfa(["PRINCIPAL_BROKER"])).toBe(true);
    expect(requiresMfa(["AUDITOR"])).toBe(true);
  });

  it("uses a 15 minute idle timeout for staff and 30 for applicants (FR-ACC-010)", () => {
    expect(idleTimeoutMinutes(["APPLICANT"])).toBe(30);
    expect(idleTimeoutMinutes(["APPLICANT", "REGISTRAR"])).toBe(15);
  });
});
