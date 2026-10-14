import "server-only";
import { cache } from "react";
import { COOKIE, readCookie } from "./cookies";
import { validateSessionToken, type SessionWithUser } from "./session";

/** Current session for this request (memoised per render). Null when signed out or expired. */
export const getCurrentSession = cache(async (): Promise<SessionWithUser | null> => {
  const token = await readCookie(COOKIE.session());
  if (!token) return null;
  const result = await validateSessionToken(token);
  return "invalid" in result ? null : result;
});
