import { generateCodeVerifier, generateState } from "arctic";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, setCookie } from "@/server/auth/cookies";
import { getCurrentSession } from "@/server/auth/current";
import { GOOGLE_SCOPES, googleClient } from "@/server/auth/google";
import { safeNextPath } from "@/server/auth/guards";
import { hasRecentAuth } from "@/server/auth/step-up";
import { env } from "@/server/env";

const absolute = (path: string) => new URL(path, env().APP_URL);

/** Starts Google sign-in (intent=signin) or account linking (intent=link) with state + PKCE. */
export async function GET(request: NextRequest) {
  const client = googleClient();
  if (!client) return NextResponse.redirect(absolute("/sign-in?error=googleDisabled"));

  const intent = request.nextUrl.searchParams.get("intent") === "link" ? "link" : "signin";
  if (intent === "link") {
    const current = await getCurrentSession();
    if (!current) return NextResponse.redirect(absolute("/sign-in"));
    // Adding a sign-in method is a sensitive change (SEC-005).
    if (!hasRecentAuth(current.session))
      return NextResponse.redirect(absolute("/settings/security?error=reauthRequired"));
  }

  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = client.createAuthorizationURL(state, verifier, GOOGLE_SCOPES);
  url.searchParams.set("prompt", "select_account");

  const expires = new Date(Date.now() + 10 * 60_000);
  await setCookie(COOKIE.oauthState(), state, expires);
  await setCookie(COOKIE.oauthVerifier(), verifier, expires);
  await setCookie(
    COOKIE.oauthIntent(),
    JSON.stringify({ intent, next: safeNextPath(request.nextUrl.searchParams.get("next")) }),
    expires,
  );
  return NextResponse.redirect(url);
}
