import { decodeIdToken, OAuth2RequestError } from "arctic";
import { NextResponse, type NextRequest } from "next/server";
import { isFullyVerified } from "@/server/auth/account";
import { clearCookie, COOKIE, readCookie, setCookie } from "@/server/auth/cookies";
import { getCurrentSession } from "@/server/auth/current";
import { googleClient } from "@/server/auth/google";
import { landingFor, safeNextPath } from "@/server/auth/guards";
import { handleGoogleIdentity, type GoogleProfile } from "@/server/auth/oauth";
import { safeEqual } from "@/server/auth/crypto";
import { env } from "@/server/env";
import { isAppError } from "@/server/errors";
import { getRequestContext } from "@/server/request-context";

const absolute = (path: string) => new URL(path, env().APP_URL);

interface GoogleClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export async function GET(request: NextRequest) {
  const client = googleClient();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = await readCookie(COOKIE.oauthState());
  const verifier = await readCookie(COOKIE.oauthVerifier());
  const rawIntent = await readCookie(COOKIE.oauthIntent());
  await Promise.all([
    clearCookie(COOKIE.oauthState()),
    clearCookie(COOKIE.oauthVerifier()),
    clearCookie(COOKIE.oauthIntent()),
  ]);

  let parsedIntent: { intent: "signin" | "link"; next: string } = {
    intent: "signin",
    next: "",
  };
  try {
    if (rawIntent) parsedIntent = JSON.parse(rawIntent);
  } catch {
    /* fall back to sign-in */
  }
  const failure = (reason: string) =>
    NextResponse.redirect(
      absolute(
        parsedIntent.intent === "link"
          ? `/settings/security?error=${reason}`
          : `/sign-in?error=${reason}`,
      ),
    );

  if (!client) return failure("googleDisabled");
  if (!code || !state || !storedState || !verifier || !safeEqual(state, storedState))
    return failure("oauthStateMismatch");

  let profile: GoogleProfile;
  try {
    const tokens = await client.validateAuthorizationCode(code, verifier);
    const claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
    if (!claims.sub || !claims.email) return failure("oauthFailed");
    profile = {
      sub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === true,
      name: claims.name ?? "",
    };
  } catch (error) {
    console.error(
      "[oauth] google code exchange failed",
      error instanceof OAuth2RequestError ? error.code : (error as Error).message,
    );
    return failure("oauthFailed");
  }

  const ctx = await getRequestContext();
  try {
    if (parsedIntent.intent === "link") {
      const current = await getCurrentSession();
      if (!current) return NextResponse.redirect(absolute("/sign-in"));
      await handleGoogleIdentity(profile, { mode: "link", userId: current.user.id }, ctx);
      return NextResponse.redirect(absolute("/settings/security?linked=google"));
    }

    const outcome = await handleGoogleIdentity(profile, { mode: "signin" }, ctx);
    if (outcome.kind === "mfa") {
      await setCookie(COOKIE.challenge(), outcome.challengeToken, outcome.expiresAt);
      return NextResponse.redirect(
        absolute(
          parsedIntent.next
            ? `/sign-in/two-step?next=${encodeURIComponent(safeNextPath(parsedIntent.next))}`
            : "/sign-in/two-step",
        ),
      );
    }
    if (outcome.kind === "session") {
      await setCookie(COOKIE.session(), outcome.token, outcome.expiresAt);
      return NextResponse.redirect(
        absolute(
          isFullyVerified(outcome.user)
            ? await landingFor(outcome.user, parsedIntent.next || null)
            : "/verify",
        ),
      );
    }
    return failure("oauthFailed");
  } catch (error) {
    if (isAppError(error)) return failure(error.code);
    throw error;
  }
}
