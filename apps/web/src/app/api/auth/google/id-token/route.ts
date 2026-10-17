import { NextResponse, type NextRequest } from "next/server";
import { isFullyVerified } from "@/server/auth/account";
import { clearCookie, COOKIE, readCookie, setCookie } from "@/server/auth/cookies";
import { getCurrentSession } from "@/server/auth/current";
import { verifyGoogleIdToken } from "@/server/auth/google-id-token";
import { landingFor, safeNextPath } from "@/server/auth/guards";
import { handleGoogleIdentity } from "@/server/auth/oauth";
import { hasRecentAuth } from "@/server/auth/step-up";
import { env, isGoogleEnabled } from "@/server/env";
import { isAppError } from "@/server/errors";
import { assertSameOrigin, contextOf, errorResponse, HttpError } from "@/server/http";
import { RATE_LIMITS, rateLimiter } from "@/server/rate-limit";
import { getRequestContext } from "@/server/request-context";

/**
 * "Sign in with Google" without a client secret (FR-ACC-006, ADR-004 amendment): the Google button
 * hands the browser a signed ID token, which is verified here and then resolved by the same
 * `handleGoogleIdentity` rules as before — no silent merge into a password account, two-step
 * sign-in when MFA is on, linking only after a recent password confirmation.
 *
 * Answers `{ redirect }`; failures redirect to the page that shows `?error=` (sign-in or Security).
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (!isGoogleEnabled()) throw new HttpError(404, "googleDisabled");
    const { ipAddress } = contextOf(request);
    const { limit, windowMs } = RATE_LIMITS.googleSignIn;
    if (!rateLimiter.consume(`google-signin:${ipAddress ?? "unknown"}`, limit, windowMs).ok)
      throw new HttpError(429, "rateLimited");

    const body = (await request.json().catch(() => null)) as {
      credential?: unknown;
      intent?: unknown;
      next?: unknown;
    } | null;
    const credential = typeof body?.credential === "string" ? body.credential : "";
    const intent = body?.intent === "link" ? "link" : "signin";
    // Raw: when absent, landingFor sends the person to their own home (back office for staff).
    const requested = typeof body?.next === "string" ? body.next : null;
    const next = safeNextPath(requested);
    const failure = (reason: string) =>
      NextResponse.json({
        redirect:
          intent === "link" ? `/settings/security?error=${reason}` : `/sign-in?error=${reason}`,
      });

    // The nonce is single-use: read it once and drop it whatever happens next.
    const nonce = await readCookie(COOKIE.oauthNonce());
    await clearCookie(COOKIE.oauthNonce());
    if (!credential || credential.length > 4096 || !nonce) return failure("oauthStateMismatch");

    let profile;
    try {
      profile = await verifyGoogleIdToken(credential, { clientId: env().GOOGLE_CLIENT_ID!, nonce });
    } catch (error) {
      if (isAppError(error)) return failure(error.code);
      throw error;
    }

    const ctx = await getRequestContext();
    try {
      if (intent === "link") {
        const current = await getCurrentSession();
        if (!current) return NextResponse.json({ redirect: "/sign-in" });
        // Adding a sign-in method is a sensitive change (SEC-005).
        if (!hasRecentAuth(current.session)) return failure("reauthRequired");
        await handleGoogleIdentity(profile, { mode: "link", userId: current.user.id }, ctx);
        return NextResponse.json({ redirect: "/settings/security?linked=google" });
      }

      const outcome = await handleGoogleIdentity(profile, { mode: "signin" }, ctx);
      if (outcome.kind === "mfa") {
        await setCookie(COOKIE.challenge(), outcome.challengeToken, outcome.expiresAt);
        return NextResponse.json({
          redirect: requested
            ? `/sign-in/two-step?next=${encodeURIComponent(next)}`
            : "/sign-in/two-step",
        });
      }
      if (outcome.kind === "session") {
        await setCookie(COOKIE.session(), outcome.token, outcome.expiresAt);
        return NextResponse.json({
          redirect: isFullyVerified(outcome.user)
            ? await landingFor(outcome.user, requested)
            : "/verify",
        });
      }
      return failure("oauthFailed");
    } catch (error) {
      if (isAppError(error)) return failure(error.code);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
