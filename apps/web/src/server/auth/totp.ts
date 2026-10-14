import { createHmac, randomBytes } from "node:crypto";

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — the profile every authenticator app supports. */
const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160-bit secret, base32 encoded (RFC 4226 recommendation). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function timeStep(at: number = Date.now()): number {
  return Math.floor(at / 1000 / STEP_SECONDS);
}

export function hotp(
  secret: string,
  counter: number,
  algorithm: "sha1" | "sha256" | "sha512" = "sha1",
): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac(algorithm, base32Decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function totp(secret: string, at: number = Date.now()): string {
  return hotp(secret, timeStep(at));
}

/**
 * Verifies a code within ±`window` steps. Returns the matched time-step so callers can
 * reject re-use (codes at or below the last accepted step), or null when invalid.
 */
export function verifyTotp(
  secret: string,
  code: string,
  options: { at?: number; window?: number; lastCounter?: number | null } = {},
): number | null {
  const { at = Date.now(), window = 1, lastCounter = null } = options;
  if (!/^\d{6}$/.test(code)) return null;
  const current = timeStep(at);
  for (let delta = -window; delta <= window; delta++) {
    const counter = current + delta;
    if (lastCounter !== null && counter <= lastCounter) continue;
    if (hotp(secret, counter) === code) return counter;
  }
  return null;
}

export function totpUri(secret: string, account: string, issuer = "REBP Portal"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
