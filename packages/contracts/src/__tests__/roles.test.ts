import { describe, expect, it } from "vitest";
import {
  applyOverrides,
  assignmentWarnings,
  can,
  CAPABILITIES,
  capabilitiesFor,
  cellLock,
  DEFAULT_PERMISSIONS,
  diffMatrix,
  idleTimeoutMinutes,
  isStaff,
  requiresMfa,
  ROLES,
  validateMatrix,
  type Capability,
  type Role,
} from "../roles";
import { matrixChangesSchema, updateUserRolesSchema, userQuerySchema } from "../access";

describe("default permission matrix (SRS Appendix D)", () => {
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
    ["SYSTEM_ADMIN", "roles.manage", true],
    ["AUDITOR", "access.view", true],
    ["AUDITOR", "audit.export", true],
    ["AUDITOR", "config.edit", false],
  ];

  it.each(cases)("%s → %s = %s", (role, capability, expected) => {
    expect(can([role], capability)).toBe(expected);
  });

  it("grants a capability when any held role allows it", () => {
    expect(can(["APPLICANT", "SUPERVISOR"], "confirmation.decide")).toBe(true);
  });

  it("is itself valid", () => {
    expect(validateMatrix(DEFAULT_PERMISSIONS)).toEqual([]);
  });

  it("unions capabilities across roles in canonical order", () => {
    const caps = capabilitiesFor(["SUPERVISOR", "APPLICANT"]);
    expect(caps).toContain("confirmation.decide");
    expect(caps).toContain("payments.pay");
    expect(caps).toEqual(CAPABILITIES.filter((c) => caps.includes(c)));
  });
});

describe("overrides", () => {
  it("applies grants and revocations and diffs back to the same overrides", () => {
    const overrides = [
      { role: "AUDITOR", capability: "reports.view", granted: false },
      { role: "REGISTRAR", capability: "audit.export", granted: true },
    ] as const;
    const matrix = applyOverrides(overrides);
    expect(can(["AUDITOR"], "reports.view", matrix)).toBe(false);
    expect(can(["REGISTRAR"], "audit.export", matrix)).toBe(true);
    expect(diffMatrix(DEFAULT_PERMISSIONS, matrix)).toEqual(
      expect.arrayContaining(overrides.map((o) => ({ ...o }))),
    );
    expect(diffMatrix(DEFAULT_PERMISSIONS, matrix)).toHaveLength(2);
  });

  it("ignores unknown capabilities", () => {
    const matrix = applyOverrides([
      { role: "APPLICANT", capability: "nope" as Capability, granted: true },
    ]);
    expect(matrix.APPLICANT).toEqual(DEFAULT_PERMISSIONS.APPLICANT);
  });
});

describe("guard-rails", () => {
  it("blocks segregation-of-duties conflicts in one role", () => {
    const matrix = applyOverrides([
      { role: "REVIEWING_OFFICER", capability: "decision.make", granted: true },
    ]);
    expect(validateMatrix(matrix)).toEqual([
      { type: "sod", role: "REVIEWING_OFFICER", capabilities: ["review.perform", "decision.make"] },
    ]);
  });

  it("blocks maker and checker in one role", () => {
    const matrix = applyOverrides([
      { role: "SYSTEM_ADMIN", capability: "config.approve", granted: true },
    ]);
    expect(validateMatrix(matrix)[0]?.type).toBe("makerChecker");
  });

  it("keeps administrators from locking themselves out", () => {
    expect(cellLock("SYSTEM_ADMIN", "roles.manage")).toBe("required");
    const matrix = applyOverrides([
      { role: "SYSTEM_ADMIN", capability: "users.manage", granted: false },
    ]);
    expect(validateMatrix(matrix)).toContainEqual({
      type: "required",
      role: "SYSTEM_ADMIN",
      capability: "users.manage",
    });
  });

  it("keeps staff-only powers away from roles without mandatory MFA", () => {
    expect(cellLock("APPLICANT", "review.perform")).toBe("staffOnly");
    expect(cellLock("PRINCIPAL_BROKER", "reports.view")).toBeNull();
    const matrix = applyOverrides([
      { role: "SUPERVISOR", capability: "audit.view", granted: true },
    ]);
    expect(validateMatrix(matrix)).toContainEqual({
      type: "staffOnly",
      role: "SUPERVISOR",
      capability: "audit.view",
    });
  });

  it("no default role holds review and decision together", () => {
    for (const role of ROLES)
      expect(can([role], "review.perform") && can([role], "decision.make")).toBe(false);
  });
});

describe("assignment warnings", () => {
  it("flags combined review + decision powers, missing MFA and staff roles on firm accounts", () => {
    expect(
      assignmentWarnings(["REVIEWING_OFFICER", "APPROVING_AUTHORITY"], { hasMfa: true }),
    ).toEqual(["sodCombined"]);
    expect(assignmentWarnings(["REGISTRAR"], { hasMfa: false })).toEqual(["mfaRequired"]);
    expect(assignmentWarnings(["AUDITOR"], { hasMfa: true, accountType: "ORGANISATION" })).toEqual([
      "staffOnOrganisation",
    ]);
    expect(assignmentWarnings(["APPLICANT"])).toEqual([]);
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

const USER_ID = "7d9c2a3e-1f4b-4c8d-9e6a-2b5f8c1d0e3a";

describe("access schemas", () => {
  it("requires at least one role", () => {
    const result = updateUserRolesSchema.safeParse({ userId: USER_ID, roles: [] });
    expect(result.error?.issues[0]?.message).toBe("validation.rolesRequired");
  });

  it("rejects unknown roles and capabilities", () => {
    expect(updateUserRolesSchema.safeParse({ userId: USER_ID, roles: ["GOD"] }).success).toBe(
      false,
    );
    expect(
      matrixChangesSchema.safeParse({
        changes: [{ role: "AUDITOR", capability: "x", granted: true }],
      }).success,
    ).toBe(false);
  });

  it("sanitises list queries instead of failing", () => {
    expect(
      userQuerySchema.parse({ q: " ali ", role: "NOPE", page: "abc", status: "active" }),
    ).toEqual({
      q: "ali",
      role: undefined,
      page: undefined,
      status: "active",
    });
  });
});
