import "server-only";
import type { Capability } from "@rebp/contracts";
import { mfaBlocks } from "../auth/mfa-policy";
import { getCurrentSession } from "../auth/current";
import { isFullyVerified } from "../auth/account";
import { assertRecentAuth } from "../auth/step-up";
import { AppError } from "../errors";
import { userCan } from "./permissions";

/**
 * Authorisation for server actions (pages use requireCapability). Server actions are public
 * endpoints, so every one that changes access re-checks the capability here — never trust the UI.
 */
/**
 * Self-service on one's own account (the profile): any signed-in, verified person, with two-step
 * verification where their roles make it mandatory. No capability: it acts on nobody else.
 */
export async function authorizeSelf() {
  const current = await getCurrentSession();
  if (!current) throw new AppError("unauthenticated");
  const { user, session } = current;
  if (!isFullyVerified(user)) throw new AppError("forbidden");
  if (mfaBlocks(user, session)) throw new AppError("mfaRequiredForAction");
  return current;
}

export async function authorizeAction(
  capability: Capability,
  {
    stepUp = false,
    requireMfa = true,
  }: {
    stepUp?: boolean;
    /** "auto": only where the user's roles make MFA mandatory (applicant actions, FR-ACC-004). */
    requireMfa?: boolean | "auto";
  } = {},
) {
  const current = await getCurrentSession();
  if (!current) throw new AppError("unauthenticated");
  const { user, session } = current;
  if (!isFullyVerified(user)) throw new AppError("forbidden");
  // Privileged actions need a session that passed two-step verification (SEC-005).
  if (requireMfa !== false && mfaBlocks(user, session, requireMfa === "auto" ? undefined : true))
    throw new AppError("mfaRequiredForAction");
  if (!(await userCan(user, capability))) throw new AppError("forbidden");
  if (stepUp) assertRecentAuth(session);
  return current;
}
