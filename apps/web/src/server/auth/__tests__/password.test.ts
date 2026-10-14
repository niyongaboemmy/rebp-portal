import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "../password";

const noBreach = async () => false;

describe("password hashing", () => {
  it("hashes with argon2id and verifies", async () => {
    const hashed = await hashPassword("correct horse battery staple");
    expect(hashed.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hashed, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(hashed, "wrong horse battery staple")).toBe(false);
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});

describe("password policy (FR-ACC-004)", () => {
  it("enforces minimum length", async () => {
    expect(await checkPasswordPolicy("short", {}, noBreach)).toBe("passwordTooShort");
  });

  it("rejects passwords containing the user's name or email", async () => {
    expect(
      await checkPasswordPolicy("aline-is-great-2026", { fullName: "Aline Uwase" }, noBreach),
    ).toBe("passwordContainsPersonalInfo");
    expect(
      await checkPasswordPolicy("my-mugisha-password", { email: "mugisha@example.rw" }, noBreach),
    ).toBe("passwordContainsPersonalInfo");
  });

  it("rejects breached passwords", async () => {
    expect(await checkPasswordPolicy("a-long-but-leaked-one", {}, async () => true)).toBe(
      "passwordBreached",
    );
  });

  it("accepts a good passphrase", async () => {
    expect(
      await checkPasswordPolicy(
        "sunny-kigali-hills-at-dawn",
        { fullName: "Aline Uwase" },
        noBreach,
      ),
    ).toBeNull();
  });
});
