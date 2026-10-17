/**
 * Roles and capabilities from SRS Appendix D (permission matrix) and SEC-004.
 * Scope qualifiers (own / assigned / firm) are enforced by the domain layer;
 * the matrix answers "may this role ever perform the capability".
 *
 * The defaults below are the SRS baseline. Administrators may override cells at runtime
 * (stored in the database), but every resulting matrix must pass `validateMatrix`.
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
  "review.assign",
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
  "roles.manage",
  "access.view",
  "firmRoles.manage",
  "audit.view",
  "audit.export",
  "reports.view",
  "backoffice.access",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_GROUPS = [
  "applications",
  "review",
  "register",
  "payments",
  "administration",
  "oversight",
] as const;
export type CapabilityGroup = (typeof CAPABILITY_GROUPS)[number];

export interface CapabilityMeta {
  group: CapabilityGroup;
  /** "staff" capabilities may only be granted to back-office roles (which require MFA). */
  scope: "staff" | "any";
}

export const CAPABILITY_META: Record<Capability, CapabilityMeta> = {
  "application.edit": { group: "applications", scope: "any" },
  "application.view": { group: "applications", scope: "any" },
  "confirmation.decide": { group: "applications", scope: "any" },
  "confirmation.override": { group: "review", scope: "staff" },
  "review.perform": { group: "review", scope: "staff" },
  "review.view": { group: "review", scope: "staff" },
  /** FR-BO-002/005: team lead — assign, reassign or take over any open file; SLA escalations. */
  "review.assign": { group: "review", scope: "staff" },
  "decision.make": { group: "review", scope: "staff" },
  "decision.view": { group: "review", scope: "staff" },
  "register.administer": { group: "register", scope: "staff" },
  "register.revoke": { group: "register", scope: "staff" },
  "payments.pay": { group: "payments", scope: "any" },
  "payments.manage": { group: "payments", scope: "staff" },
  "payments.view": { group: "payments", scope: "staff" },
  "config.edit": { group: "administration", scope: "staff" },
  "config.approve": { group: "administration", scope: "staff" },
  "users.manage": { group: "administration", scope: "staff" },
  "roles.manage": { group: "administration", scope: "staff" },
  "access.view": { group: "administration", scope: "staff" },
  "firmRoles.manage": { group: "applications", scope: "any" },
  "audit.view": { group: "oversight", scope: "staff" },
  "audit.export": { group: "oversight", scope: "staff" },
  "reports.view": { group: "oversight", scope: "any" },
  "backoffice.access": { group: "oversight", scope: "staff" },
};

/** SRS Appendix D baseline, keyed by capability for readability. */
const BASELINE: Record<Capability, readonly Role[]> = {
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
    "SYSTEM_ADMIN",
  ],
  "confirmation.decide": ["SUPERVISOR", "PRINCIPAL_BROKER"],
  "confirmation.override": ["REVIEWING_OFFICER", "SYSTEM_ADMIN"],
  "review.perform": ["REVIEWING_OFFICER", "SYSTEM_ADMIN"],
  "review.view": [
    "REVIEWING_OFFICER",
    "APPROVING_AUTHORITY",
    "REGISTRAR",
    "AUDITOR",
    "SYSTEM_ADMIN",
  ],
  "review.assign": ["APPROVING_AUTHORITY", "SYSTEM_ADMIN"],
  "decision.make": ["APPROVING_AUTHORITY", "SYSTEM_ADMIN"],
  "decision.view": ["APPROVING_AUTHORITY", "REGISTRAR", "AUDITOR", "SYSTEM_ADMIN"],
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
    "SYSTEM_ADMIN",
  ],
  "config.edit": ["SYSTEM_ADMIN", "FINANCE_OFFICER"],
  "config.approve": ["APPROVING_AUTHORITY"],
  "users.manage": ["SYSTEM_ADMIN"],
  "roles.manage": ["SYSTEM_ADMIN"],
  "access.view": ["SYSTEM_ADMIN", "AUDITOR"],
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

/** Role → granted capabilities. */
export type PermissionMatrix = Record<Role, readonly Capability[]>;

function buildMatrix(granted: (role: Role, capability: Capability) => boolean): PermissionMatrix {
  const matrix = {} as Record<Role, Capability[]>;
  for (const role of ROLES) matrix[role] = CAPABILITIES.filter((cap) => granted(role, cap));
  return matrix;
}

export const DEFAULT_PERMISSIONS: PermissionMatrix = buildMatrix((role, cap) =>
  BASELINE[cap].includes(role),
);

export function isStaffRole(role: Role): boolean {
  return (STAFF_ROLES as readonly Role[]).includes(role);
}

export function isStaff(roles: readonly Role[]): boolean {
  return roles.some(isStaffRole);
}

export function requiresMfa(roles: readonly Role[]): boolean {
  return roles.some((role) => MFA_REQUIRED_ROLES.includes(role));
}

/** Idle timeout in minutes (FR-ACC-010): staff 15, applicants 30. */
export function idleTimeoutMinutes(roles: readonly Role[]): number {
  return isStaff(roles) ? 15 : 30;
}

/** Union of capabilities granted by the given roles. */
export function capabilitiesFor(
  roles: readonly Role[],
  matrix: PermissionMatrix = DEFAULT_PERMISSIONS,
): Capability[] {
  const granted = new Set<Capability>();
  for (const role of roles) for (const cap of matrix[role] ?? []) granted.add(cap);
  return CAPABILITIES.filter((cap) => granted.has(cap));
}

export function can(
  roles: readonly Role[],
  capability: Capability,
  matrix: PermissionMatrix = DEFAULT_PERMISSIONS,
): boolean {
  return roles.some((role) => matrix[role]?.includes(capability));
}

// ---------------------------------------------------------------------------
// Overrides and guard-rails
// ---------------------------------------------------------------------------

export interface PermissionOverride {
  role: Role;
  capability: Capability;
  granted: boolean;
}

export function applyOverrides(
  overrides: readonly PermissionOverride[],
  base: PermissionMatrix = DEFAULT_PERMISSIONS,
): PermissionMatrix {
  const sets = {} as Record<Role, Set<Capability>>;
  for (const role of ROLES) sets[role] = new Set(base[role]);
  for (const { role, capability, granted } of overrides) {
    if (!sets[role] || !CAPABILITY_META[capability]) continue;
    if (granted) sets[role].add(capability);
    else sets[role].delete(capability);
  }
  return buildMatrix((role, cap) => sets[role].has(cap));
}

/** Cells that differ between two matrices, expressed as overrides of `from`. */
export function diffMatrix(from: PermissionMatrix, to: PermissionMatrix): PermissionOverride[] {
  const changes: PermissionOverride[] = [];
  for (const role of ROLES) {
    for (const capability of CAPABILITIES) {
      const before = from[role].includes(capability);
      const after = to[role].includes(capability);
      if (before !== after) changes.push({ role, capability, granted: after });
    }
  }
  return changes;
}

/** Pairs a single role may not hold together (SRS §16.3 #6 segregation of duties; maker-checker). */
export const CONFLICTING_CAPABILITIES: ReadonlyArray<{
  id: "sod" | "makerChecker";
  pair: [Capability, Capability];
}> = [
  { id: "sod", pair: ["review.perform", "decision.make"] },
  { id: "makerChecker", pair: ["config.edit", "config.approve"] },
];

/**
 * Roles allowed to hold review and decision powers together (owner request, UX-032): the system
 * administrator can validate and approve applications. Segregation of duties still holds where it
 * matters, per application (BR-091): whoever reviewed or was assigned a file can never decide it.
 */
export const SOD_EXEMPT_ROLES: readonly Role[] = ["SYSTEM_ADMIN"];

/** Cells that are fixed, with the reason. Prevents lock-out and keeps staff-only powers behind MFA. */
export type CellLock = "required" | "staffOnly";

const REQUIRED_GRANTS: ReadonlyArray<[Role, Capability]> = [
  ["SYSTEM_ADMIN", "users.manage"],
  ["SYSTEM_ADMIN", "roles.manage"],
  ["SYSTEM_ADMIN", "access.view"],
  ...STAFF_ROLES.map((role): [Role, Capability] => [role, "backoffice.access"]),
];

export function cellLock(role: Role, capability: Capability): CellLock | null {
  if (REQUIRED_GRANTS.some(([r, c]) => r === role && c === capability)) return "required";
  if (CAPABILITY_META[capability].scope === "staff" && !isStaffRole(role)) return "staffOnly";
  return null;
}

export type MatrixViolation =
  | { type: "sod" | "makerChecker"; role: Role; capabilities: [Capability, Capability] }
  | { type: "required"; role: Role; capability: Capability }
  | { type: "staffOnly"; role: Role; capability: Capability };

/** Every violation in a matrix. An empty list means the matrix may be saved. */
export function validateMatrix(matrix: PermissionMatrix): MatrixViolation[] {
  const violations: MatrixViolation[] = [];
  for (const role of ROLES) {
    const caps = matrix[role];
    for (const { id, pair } of CONFLICTING_CAPABILITIES) {
      if (id === "sod" && SOD_EXEMPT_ROLES.includes(role)) continue;
      if (caps.includes(pair[0]) && caps.includes(pair[1]))
        violations.push({ type: id, role, capabilities: pair });
    }
    for (const capability of CAPABILITIES) {
      const lock = cellLock(role, capability);
      if (lock === "required" && !caps.includes(capability))
        violations.push({ type: "required", role, capability });
      if (lock === "staffOnly" && caps.includes(capability))
        violations.push({ type: "staffOnly", role, capability });
    }
  }
  return violations;
}

export type AssignmentWarning = "sodCombined" | "mfaRequired" | "staffOnOrganisation";

/**
 * Advisory checks when giving a person a set of roles. Combined review + decision powers are allowed
 * (BR-091 is enforced per application), but the administrator is told.
 */
export function assignmentWarnings(
  roles: readonly Role[],
  options: {
    matrix?: PermissionMatrix;
    hasMfa?: boolean;
    accountType?: "INDIVIDUAL" | "ORGANISATION";
  } = {},
): AssignmentWarning[] {
  const caps = capabilitiesFor(roles, options.matrix);
  const warnings: AssignmentWarning[] = [];
  if (caps.includes("review.perform") && caps.includes("decision.make"))
    warnings.push("sodCombined");
  if (requiresMfa(roles) && !options.hasMfa) warnings.push("mfaRequired");
  if (options.accountType === "ORGANISATION" && isStaff(roles))
    warnings.push("staffOnOrganisation");
  return warnings;
}
