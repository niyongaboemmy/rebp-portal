import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { createHash } from "node:crypto";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@rebp/contracts";
import { env } from "../env";

// OWASP Password Storage Cheat Sheet: argon2id, m=19 MiB, t=2, p=1.
const ARGON2_OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hash used to equalise timing when the account does not exist (prevents user enumeration). */
let dummyHash: Promise<string> | undefined;
export function dummyVerify(password: string): Promise<boolean> {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  return dummyHash.then((h) => verifyPassword(h, password));
}

export type PasswordProblem =
  "passwordTooShort" | "passwordTooLong" | "passwordContainsPersonalInfo" | "passwordBreached";

/** Server-side password policy (FR-ACC-004): length, no personal info, not in a known breach. */
export async function checkPasswordPolicy(
  password: string,
  personal: { email?: string; fullName?: string } = {},
  breachCheck: (password: string) => Promise<boolean> = isBreachedPassword,
): Promise<PasswordProblem | null> {
  if (password.length < PASSWORD_MIN_LENGTH) return "passwordTooShort";
  if (password.length > PASSWORD_MAX_LENGTH) return "passwordTooLong";
  const lowered = password.toLowerCase();
  const tokens = [personal.email?.split("@")[0], ...(personal.fullName?.split(/\s+/) ?? [])]
    .filter((t): t is string => Boolean(t && t.length >= 4))
    .map((t) => t.toLowerCase());
  if (tokens.some((token) => lowered.includes(token))) return "passwordContainsPersonalInfo";
  if (await breachCheck(password)) return "passwordBreached";
  return null;
}

/**
 * Have I Been Pwned range API (k-anonymity: only the first 5 SHA-1 chars leave the server).
 * Fails open on network errors so an outage cannot block sign-ups.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  if (!env().AUTH_BREACHED_PASSWORD_CHECK) return false;
  const digest = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return false;
    const body = await response.text();
    return body.split("\n").some((line) => {
      const [candidate, count] = line.trim().split(":");
      return candidate === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
