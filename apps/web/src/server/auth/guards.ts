import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Capability } from "@rebp/contracts";
import { userCan } from "../access/permissions";
import { profileBlocks } from "../profile/profile";
import { isFullyVerified } from "./account";
import { getCurrentSession } from "./current";
import { mfaBlocks, mfaRecommended } from "./mfa-policy";
import type { SessionWithUser } from "./session";

/** Pathname forwarded by the proxy so guards can send users back after sign-in. */
async function currentPath() {
  return (await headers()).get("x-pathname") ?? "/dashboard";
}

interface GuardOptions {
  /** FR-ACC-001: email and phone must be verified before application functions. Default true. */
  requireVerified?: boolean;
  /** Allow access while a mandatory second factor is not yet enrolled (the security page itself). */
  allowPendingMfa?: boolean;
  /**
   * Allow access while an applicant's profile is incomplete (UX-010): the profile page itself and
   * account settings. Everywhere else an applicant completes their profile first.
   */
  allowIncompleteProfile?: boolean;
}

export async function requireUser({
  requireVerified = true,
  allowPendingMfa = false,
  allowIncompleteProfile = false,
}: GuardOptions = {}): Promise<SessionWithUser> {
  const current = await getCurrentSession();
  if (!current) redirect(`/sign-in?next=${encodeURIComponent(await currentPath())}`);
  const { user, session } = current;
  if (requireVerified && !isFullyVerified(user)) redirect("/verify");
  if (mfaBlocks(user, session) && !allowPendingMfa) redirect("/settings/security?setup=required");
  // Verified and secured: an applicant completes their profile before anything else, then
  // comes back here.
  if (requireVerified && !allowIncompleteProfile) {
    // Account settings (the profile itself, security, access) stay reachable: the check is by
    // path too, so a layout guarding these pages can never send the profile page to itself.
    const path = await currentPath();
    if (!path.startsWith("/settings/") && (await profileBlocks(user)))
      redirect(`/settings/profile?welcome=1&next=${encodeURIComponent(path)}`);
  }
  return current;
}

export async function requireCapability(
  capability: Capability,
  options?: GuardOptions,
): Promise<SessionWithUser> {
  const current = await requireUser(options);
  if (!(await userCan(current.user, capability))) redirect("/forbidden");
  return current;
}

/** For auth pages: bounce signed-in users to their home. */
export async function redirectIfSignedIn() {
  if (await getCurrentSession()) redirect("/dashboard");
}

/** Only allow same-origin relative paths as post-login destinations (open-redirect guard). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback;
  return next;
}

/**
 * Where a user goes after signing in or verifying (UX-010): their profile first when it's
 * incomplete (then back to `next`), else `next`. Decided here rather than by a redirect after
 * the client has left the sign-in pages, which the router can't settle across layouts.
 */
export async function landingFor(
  user: Parameters<typeof profileBlocks>[0] & Parameters<typeof mfaRecommended>[0],
  next?: string | null,
): Promise<string> {
  const target = safeNextPath(next);
  if (await profileBlocks(user))
    return `/settings/profile?welcome=1&next=${encodeURIComponent(target)}`;
  // Staff without two-step are sent to set it up after signing in, with a way to skip (FR-ACC-004).
  if (mfaRecommended(user))
    return `/settings/security?setup=required&next=${encodeURIComponent(target)}`;
  return target;
}
