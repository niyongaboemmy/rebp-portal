import "server-only";
import { cookies } from "next/headers";
import { isProduction } from "../env";

/** `__Host-` prefix pins the cookie to this origin over HTTPS (SEC-002); plain names on http://localhost. */
function name(base: string) {
  return isProduction() ? `__Host-${base}` : base;
}

export const COOKIE = {
  session: () => name("rebp_session"),
  challenge: () => name("rebp_mfa"),
  oauthState: () => name("rebp_oauth_state"),
  oauthVerifier: () => name("rebp_oauth_verifier"),
  oauthIntent: () => name("rebp_oauth_intent"),
  /** One-time nonce bound into the Google ID token (replay protection). */
  oauthNonce: () => name("rebp_oauth_nonce"),
};

const base = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: "lax" as const,
  path: "/",
});

export async function setCookie(cookieName: string, value: string, expires: Date) {
  (await cookies()).set(cookieName, value, { ...base(), expires });
}

export async function readCookie(cookieName: string) {
  return (await cookies()).get(cookieName)?.value;
}

export async function clearCookie(cookieName: string) {
  (await cookies()).set(cookieName, "", { ...base(), maxAge: 0 });
}
