import "server-only";
import { createPublicKey, verify, type JsonWebKey } from "node:crypto";
import { AppError } from "../errors";
import type { GoogleProfile } from "./oauth";

/**
 * Verifies a Google ID token from Google Identity Services (FR-ACC-006, ADR-004 amendment). The browser
 * receives the token directly from Google, so it is untrusted input until every check here passes:
 * RS256 signature against Google's published keys, issuer, audience (our client ID), expiry and
 * the one-time nonce we issued. Only the client ID is needed — no client secret.
 */

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
/** Tolerated clock difference between us and Google. */
const SKEW_SECONDS = 60;

export interface GoogleJwk extends JsonWebKey {
  kid: string;
}

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
}

function decodeSegment<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch {
    throw new AppError("oauthFailed");
  }
}

/**
 * Pure verification against a given key set and clock (unit-tested). Throws `oauthFailed` for any
 * malformed, forged, expired or misaddressed token, and `oauthStateMismatch` for a nonce that isn't
 * the one this browser was issued (a replayed or injected token).
 */
export function verifyIdToken(
  token: string,
  keys: readonly GoogleJwk[],
  expected: { clientId: string; nonce: string },
  nowSeconds: number,
): GoogleProfile {
  const parts = token.split(".");
  if (parts.length !== 3) throw new AppError("oauthFailed");
  const [rawHeader, rawPayload, rawSignature] = parts as [string, string, string];

  const header = decodeSegment<{ alg?: string; kid?: string }>(rawHeader);
  if (header.alg !== "RS256" || !header.kid) throw new AppError("oauthFailed");
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new AppError("oauthFailed");

  const signed = verify(
    "RSA-SHA256",
    Buffer.from(`${rawHeader}.${rawPayload}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(rawSignature, "base64url"),
  );
  if (!signed) throw new AppError("oauthFailed");

  const claims = decodeSegment<IdTokenClaims>(rawPayload);
  if (!claims.iss || !ISSUERS.has(claims.iss)) throw new AppError("oauthFailed");
  if (claims.aud !== expected.clientId) throw new AppError("oauthFailed");
  if (typeof claims.exp !== "number" || claims.exp + SKEW_SECONDS < nowSeconds)
    throw new AppError("oauthFailed");
  if (typeof claims.iat === "number" && claims.iat - SKEW_SECONDS > nowSeconds)
    throw new AppError("oauthFailed");
  if (!claims.nonce || claims.nonce !== expected.nonce) throw new AppError("oauthStateMismatch");
  if (!claims.sub || !claims.email) throw new AppError("oauthFailed");

  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: claims.name ?? "",
  };
}

let cache: { keys: GoogleJwk[]; expiresAt: number } | null = null;

/** Google's signing keys, cached for as long as Google's Cache-Control allows. */
async function googleKeys(forceRefresh = false): Promise<GoogleJwk[]> {
  if (!forceRefresh && cache && cache.expiresAt > Date.now()) return cache.keys;
  const response = await fetch(JWKS_URL, { cache: "no-store" });
  if (!response.ok) throw new AppError("oauthFailed");
  const body = (await response.json()) as { keys?: GoogleJwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1]);
  cache = {
    keys: body.keys ?? [],
    expiresAt: Date.now() + (Number.isFinite(maxAge) && maxAge > 0 ? maxAge * 1000 : 3_600_000),
  };
  return cache.keys;
}

export async function verifyGoogleIdToken(
  token: string,
  expected: { clientId: string; nonce: string },
): Promise<GoogleProfile> {
  const now = Math.floor(Date.now() / 1000);
  let keys = await googleKeys();
  // Google rotates keys; an unknown kid means our cache is stale, so refetch once.
  const kid = decodeSegment<{ kid?: string }>(token.split(".")[0] ?? "").kid;
  if (kid && !keys.some((key) => key.kid === kid)) keys = await googleKeys(true);
  return verifyIdToken(token, keys, expected, now);
}
