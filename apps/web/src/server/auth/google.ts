import "server-only";
import { Google } from "arctic";
import { env, isGoogleEnabled } from "../env";

export const GOOGLE_SCOPES = ["openid", "email", "profile"];

export function googleClient(): Google | null {
  if (!isGoogleEnabled()) return null;
  const config = env();
  return new Google(
    config.GOOGLE_CLIENT_ID!,
    config.GOOGLE_CLIENT_SECRET!,
    `${config.APP_URL}/api/auth/google/callback`,
  );
}
