/**
 * Roles and capabilities from SRS Appendix D (permission matrix) and SEC-004.
 * Scope qualifiers (own / assigned / firm) are enforced by the domain layer;
 * this matrix answers "may this role ever perform the capability".
 */
export const ROLES = [
  "APPLICANT",
  "SUPERVISOR",
  "PRINCIPAL_BROKER",
  "FIRM_ADMIN",
  "REVIEWING_OFFICER",
  "APPROVING_AUTHORITY",
  "REGISTRAR",
  "FINANCE_OFFICER",
  "SYSTEM_ADMIN",
  "AUDITOR",
] as const;
export type Role = (typeof ROLES)[number];

/** Back-office roles: MFA is mandatory and the idle timeout is 15 minutes (FR-ACC-004, FR-ACC-010). */
export const STAFF_ROLES = [
  "REVIEWING_OFFICER",
  "APPROVING_AUTHORITY",
  "REGISTRAR",
  "FINANCE_OFFICER",
  "SYSTEM_ADMIN",
  "AUDITOR",
] as const satisfies readonly Role[];

/** Roles for which MFA is mandatory (FR-ACC-004, SEC-005). */
export const MFA_REQUIRED_ROLES: readonly Role[] = [...STAFF_ROLES, "PRINCIPAL_BROKER"];

export const CAPABILITIES = [
  "application.edit",
  "application.view",
  "confirmation.decide",
  "confirmation.override",
  "review.perform",
  "review.view",
  "decision.make",
  "decision.view",
  "register.administer",
  "register.revoke",
  "payments.pay",
  "payments.manage",
  "payments.view",
  "config.edit",
  "config.approve",
  "users.manage",
  "firmRoles.manage",
  "audit.view",
  "audit.export",
  "reports.view",
  "backoffice.access",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const MATRIX: Record<Capability, readonly Role[]> = {
  "application.edit": ["APPLICANT", "PRINCIPAL_BROKER", "FIRM_ADMIN", "REVIEWING_OFFICER"],
  "application.view": [
    "APPLICANT",
    "SUPERVISOR",
    "PRINCIPAL_BROKER",
    "FIRM_ADMIN",
    "REVIEWING_OFFICER",
    "APPROVING_AUTHORITY",
    "REGISTRAR",
    "FINANCE_OFFICER",
    "AUDITOR",
  ],
  "confirmation.decide": ["SUPERVISOR", "PRINCIPAL_BROKER"],
  "confirmation.override": ["REVIEWING_OFFICER"],
  "review.perform": ["REVIEWING_OFFICER"],
  "review.view": ["REVIEWING_OFFICER", "APPROVING_AUTHORITY", "REGISTRAR", "AUDITOR"],
  "decision.make": ["APPROVING_AUTHORITY"],
  "decision.view": ["APPROVING_AUTHORITY", "REGISTRAR", "AUDITOR"],
  "register.administer": ["REGISTRAR"],
  "register.revoke": ["APPROVING_AUTHORITY"],
  "payments.pay": ["APPLICANT", "PRINCIPAL_BROKER", "FIRM_ADMIN"],
  "payments.manage": ["FINANCE_OFFICER"],
  "payments.view": [
    "REVIEWING_OFFICER",
    "APPROVING_AUTHORITY",
    "REGISTRAR",
    "FINANCE_OFFICER",
    "AUDITOR",
  ],
  "config.edit": ["SYSTEM_ADMIN", "FINANCE_OFFICER"],
  "config.approve": ["APPROVING_AUTHORITY"],
  "users.manage": ["SYSTEM_ADMIN"],
  "firmRoles.manage": ["PRINCIPAL_BROKER", "FIRM_ADMIN"],
  "audit.view": ["REGISTRAR", "SYSTEM_ADMIN", "AUDITOR"],
  "audit.export": ["AUDITOR"],
  "reports.view": [
    "PRINCIPAL_BROKER",
    "FIRM_ADMIN",
    "REVIEWING_OFFICER",
    "APPROVING_AUTHORITY",
    "REGISTRAR",
    "FINANCE_OFFICER",
    "SYSTEM_ADMIN",
    "AUDITOR",
  ],
  "backoffice.access": STAFF_ROLES,
};

export function can(roles: readonly Role[], capability: Capability): boolean {
  const allowed = MATRIX[capability];
  return roles.some((role) => allowed.includes(role));
}

export function isStaff(roles: readonly Role[]): boolean {
  return roles.some((role) => (STAFF_ROLES as readonly Role[]).includes(role));
}

export function requiresMfa(roles: readonly Role[]): boolean {
  return roles.some((role) => MFA_REQUIRED_ROLES.includes(role));
}

/** Idle timeout in minutes (FR-ACC-010): staff 15, applicants 30. */
export function idleTimeoutMinutes(roles: readonly Role[]): number {
  return isStaff(roles) ? 15 : 30;
}
