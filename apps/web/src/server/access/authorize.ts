import "server-only";
import type { Capability } from "@rebp/contracts";
import { getCurrentSession } from "../auth/current";
import { isFullyVerified } from "../auth/account";
import { assertRecentAuth } from "../auth/step-up";
import { AppError } from "../errors";
import { userCan } from "./permissions";

/**
 * Authorisation for server actions (pages use requireCapability). Server actions are public
 * endpoints, so every one that changes access re-checks the capability here — never trust the UI.
 */
export async function authorizeAction(
  capability: Capability,
  { stepUp = false, requireMfa = true }: { stepUp?: boolean; requireMfa?: boolean } = {},
) {
  const current = await getCurrentSession();
  if (!current) throw new AppError("unauthenticated");
  const { user, session } = current;
  if (!isFullyVerified(user)) throw new AppError("forbidden");
  // Privileged actions need a session that passed two-step verification (SEC-005).
  if (requireMfa && (user.mfaMethods.length === 0 || !session.mfaVerified))
    throw new AppError("mfaRequiredForAction");
  if (!(await userCan(user, capability))) throw new AppError("forbidden");
  if (stepUp) assertRecentAuth(session);
  return current;
}
