import { describe, expect, it } from "vitest";
import { decrypt, encrypt, hmac, numericCode, randomToken, safeEqual, sha256 } from "../crypto";

describe("field encryption (SEC-003)", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encrypt("JBSWY3DPEHPK3PXP");
    const b = encrypt("JBSWY3DPEHPK3PXP");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1.")).toBe(true);
    expect(decrypt(a)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("detects tampering through the GCM tag", () => {
    const parts = encrypt("secret").split(".");
    const ct = Buffer.from(parts[3]!, "base64url");
    ct[0] = ct[0]! ^ 0xff;
    parts[3] = ct.toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("rejects unknown formats", () => {
    expect(() => decrypt("v0.a.b.c")).toThrow("Unsupported");
  });
});

describe("tokens and hashes", () => {
  it("creates 256-bit url-safe tokens", () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(token);
  });

  it("generates numeric codes of the requested length", () => {
    for (let i = 0; i < 50; i++) expect(numericCode(6)).toMatch(/^\d{6}$/);
  });

  it("hashes deterministically", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hmac("123456")).toBe(hmac("123456"));
    expect(hmac("123456")).not.toBe(hmac("123457"));
  });

  it("compares in constant time", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
