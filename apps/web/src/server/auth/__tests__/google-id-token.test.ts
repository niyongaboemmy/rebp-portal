import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AppError } from "@/server/errors";
import { verifyIdToken, type GoogleJwk } from "../google-id-token";

// FR-ACC-006 / ADR-004 amendment: Google ID tokens are untrusted until every check passes.
const CLIENT_ID = "test-client.apps.googleusercontent.com";
const NONCE = "nonce-123";
const NOW = 1_800_000_000;

function keyPair(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid } as GoogleJwk };
}

const google = keyPair("google-1");
const attacker = keyPair("google-1");

function token(
  claims: Record<string, unknown>,
  { key = google.privateKey, header = { alg: "RS256", kid: "google-1" } } = {} as {
    key?: KeyObject;
    header?: Record<string, unknown>;
  },
) {
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${enc(header)}.${enc(claims)}`;
  return `${body}.${sign("RSA-SHA256", Buffer.from(body), key).toString("base64url")}`;
}

const valid = {
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  sub: "1234567890",
  email: "aline@example.rw",
  email_verified: true,
  name: "Aline Uwase",
  iat: NOW - 10,
  exp: NOW + 3600,
  nonce: NONCE,
};

const check = (jwt: string, nonce = NONCE) =>
  verifyIdToken(jwt, [google.jwk], { clientId: CLIENT_ID, nonce }, NOW);

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof AppError ? error.code : "other";
  }
  return "none";
};

describe("verifyIdToken", () => {
  it("accepts a genuine token and returns the profile", () => {
    expect(check(token(valid))).toEqual({
      sub: "1234567890",
      email: "aline@example.rw",
      emailVerified: true,
      name: "Aline Uwase",
    });
  });

  it("accepts the bare issuer form Google also uses", () => {
    expect(check(token({ ...valid, iss: "accounts.google.com" })).sub).toBe("1234567890");
  });

  it("reports an unverified Google email as unverified, for the domain to refuse", () => {
    expect(check(token({ ...valid, email_verified: false })).emailVerified).toBe(false);
  });

  it("rejects a token signed by any other key", () => {
    expect(codeOf(() => check(token(valid, { key: attacker.privateKey })))).toBe("oauthFailed");
  });

  it("rejects a tampered payload", () => {
    const [h, , s] = token(valid).split(".");
    const forged = Buffer.from(JSON.stringify({ ...valid, email: "admin@x.rw" })).toString(
      "base64url",
    );
    expect(codeOf(() => check(`${h}.${forged}.${s}`))).toBe("oauthFailed");
  });

  it("rejects alg confusion and unknown keys", () => {
    expect(codeOf(() => check(token(valid, { header: { alg: "none", kid: "google-1" } })))).toBe(
      "oauthFailed",
    );
    expect(codeOf(() => check(token(valid, { header: { alg: "RS256", kid: "other" } })))).toBe(
      "oauthFailed",
    );
  });

  it("rejects another app's token, a foreign issuer and an expired token", () => {
    expect(codeOf(() => check(token({ ...valid, aud: "someone-else" })))).toBe("oauthFailed");
    expect(codeOf(() => check(token({ ...valid, iss: "https://evil.example" })))).toBe(
      "oauthFailed",
    );
    expect(codeOf(() => check(token({ ...valid, exp: NOW - 120 })))).toBe("oauthFailed");
  });

  it("rejects a token minted for a different sign-in attempt (nonce)", () => {
    expect(codeOf(() => check(token(valid), "another-nonce"))).toBe("oauthStateMismatch");
    expect(codeOf(() => check(token({ ...valid, nonce: undefined })))).toBe("oauthStateMismatch");
  });

  it("rejects malformed input", () => {
    expect(codeOf(() => check("not-a-jwt"))).toBe("oauthFailed");
    expect(codeOf(() => check("a.b.c"))).toBe("oauthFailed");
  });
});
