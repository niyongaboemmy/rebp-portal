import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  timeStep,
  totp,
  totpUri,
  verifyTotp,
} from "../totp";

// RFC 6238 Appendix B, SHA-1 seed "12345678901234567890" (last 6 of the 8-digit vectors).
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const RFC_VECTORS: Array<[number, string]> = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("TOTP (RFC 6238)", () => {
  it.each(RFC_VECTORS)("matches the RFC vector at t=%i", (seconds, expected) => {
    expect(totp(RFC_SECRET, seconds * 1000)).toBe(expected);
  });

  it("matches RFC 4226 HOTP vectors", () => {
    expect(hotp(RFC_SECRET, 0)).toBe("755224");
    expect(hotp(RFC_SECRET, 9)).toBe("520489");
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 17]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(() => base32Decode("not*base32")).toThrow();
  });

  it("generates 160-bit secrets", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
  });

  it("accepts codes within ±1 step and rejects older ones", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totp(secret, now - 30_000), { at: now })).toBe(timeStep(now) - 1);
    expect(verifyTotp(secret, totp(secret, now + 30_000), { at: now })).toBe(timeStep(now) + 1);
    expect(verifyTotp(secret, totp(secret, now - 90_000), { at: now })).toBeNull();
  });

  it("rejects replay of an already accepted step", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const code = totp(secret, now);
    const step = verifyTotp(secret, code, { at: now });
    expect(step).not.toBeNull();
    expect(verifyTotp(secret, code, { at: now, lastCounter: step })).toBeNull();
  });

  it("rejects malformed codes", () => {
    expect(verifyTotp(RFC_SECRET, "12345")).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef")).toBeNull();
  });

  it("builds an otpauth URI authenticator apps understand", () => {
    const uri = new URL(totpUri("JBSWY3DPEHPK3PXP", "aline@example.rw"));
    expect(uri.protocol).toBe("otpauth:");
    expect(uri.host).toBe("totp");
    expect(decodeURIComponent(uri.pathname)).toBe("/REBP Portal:aline@example.rw");
    expect(uri.searchParams.get("secret")).toBe("JBSWY3DPEHPK3PXP");
    expect(uri.searchParams.get("issuer")).toBe("REBP Portal");
  });
});
