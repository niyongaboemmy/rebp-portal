import { generateState } from "arctic";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, setCookie } from "@/server/auth/cookies";
import { isGoogleEnabled } from "@/server/env";
import { contextOf, errorResponse, HttpError } from "@/server/http";
import { RATE_LIMITS, rateLimiter } from "@/server/rate-limit";

/**
 * Issues the one-time nonce the Google button binds into its ID token (FR-ACC-006). The browser
 * keeps only the value; the httpOnly cookie copy is what the token is checked against.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isGoogleEnabled()) throw new HttpError(404, "googleDisabled");
    const { ipAddress } = contextOf(request);
    const { limit, windowMs } = RATE_LIMITS.googleSignIn;
    if (!rateLimiter.consume(`google-nonce:${ipAddress ?? "unknown"}`, limit, windowMs).ok)
      throw new HttpError(429, "rateLimited");
    const nonce = generateState();
    await setCookie(COOKIE.oauthNonce(), nonce, new Date(Date.now() + 10 * 60_000));
    return NextResponse.json({ nonce }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
