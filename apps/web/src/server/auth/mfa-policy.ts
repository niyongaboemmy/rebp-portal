import "server-only";
import { requiresMfa, type Role } from "@rebp/contracts";
import { isMfaEnforced } from "../env";

/**
 * Two-step policy in one place (FR-ACC-004, ADR-004 amendment 2026-10-17). Used by page guards,
 * server actions and route handlers so they can never disagree.
 *
 * - Someone who HAS a second factor must have passed it this session, always.
 * - Someone who has NOT set one up is blocked only when two-step is mandatory for them: their
 *   roles call for it AND enforcement is on (MFA_ENFORCE). Otherwise they are only nudged.
 */
export function mfaBlocks(
  user: { roles: Role[]; mfaMethods: string[] },
  session: { mfaVerified: boolean },
  mandatory = requiresMfa(user.roles),
): boolean {
  if (user.mfaMethods.length > 0) return !session.mfaVerified;
  return mandatory && isMfaEnforced();
}

/** Recommend setting up two-step: their roles call for it and they have none yet. */
export function mfaRecommended(user: { roles: Role[]; mfaMethods: string[] }): boolean {
  return requiresMfa(user.roles) && user.mfaMethods.length === 0;
}
