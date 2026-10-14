import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { env } from "../env";

/** URL-safe random token with `bytes` of entropy (default 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Keyed hash for short secrets (OTP and recovery codes) so a DB leak cannot brute-force them offline. */
export function hmac(value: string): string {
  return createHmac("sha256", env().AUTH_SECRET).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Uniformly random numeric code, e.g. "042917". */
export function numericCode(length = 6): string {
  return Array.from({ length }, () => randomInt(0, 10)).join("");
}

function encryptionKey(): Buffer {
  const raw = env().APP_ENCRYPTION_KEY;
  const decoded = Buffer.from(raw, "base64");
  // Accept a proper 32-byte base64 key; otherwise derive one so misformatted keys still yield AES-256.
  return decoded.length === 32 ? decoded : createHash("sha256").update(raw).digest();
}

/** AES-256-GCM field encryption (SEC-003). Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ciphertext]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext)
    throw new Error("Unsupported ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
