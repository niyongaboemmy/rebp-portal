import "server-only";
import type { Capability } from "@rebp/contracts";
import { userCan } from "@/server/access/permissions";
import { maskEmail } from "@/server/audit/audit";
import { apiUser, HttpError } from "@/server/http";

/**
 * Export gate (FR-RPT-005, FR-AUD-004): an authenticated, MFA-verified user holding *every*
 * listed capability. Capabilities come from the effective permission matrix, so an
 * administrator's matrix edit is honoured here as everywhere else — never role names.
 */
export async function exportUser(required: readonly [Capability, ...Capability[]]) {
  const [first, ...rest] = required;
  const current = await apiUser(first);
  for (const capability of rest)
    if (!(await userCan(current.user, capability))) throw new HttpError(403, "forbidden");
  return current;
}

/** Privacy-safe echo of a free-text filter for the audit record (ADR-007: no raw PII). */
export function maskedTerm(term: string | undefined): string | undefined {
  if (!term) return undefined;
  if (term.includes("@")) return maskEmail(term);
  return term.length > 3 ? `${term.slice(0, 3)}***` : "***";
}
