import { describe, expect, it } from "vitest";
import {
  emailSchema,
  estimatePasswordStrength,
  normalisePhone,
  phoneSchema,
  recoveryCodeSchema,
  signUpSchema,
  twoStepSchema,
} from "../auth";

const validSignUp = {
  accountType: "INDIVIDUAL",
  fullName: "Aline Uwase",
  email: "Aline@Example.RW ",
  phone: "078 812 3456",
  password: "correct-horse-battery",
  confirmPassword: "correct-horse-battery",
  acceptPrivacy: true,
} as const;

describe("signUpSchema", () => {
  it("normalises email and phone", () => {
    const parsed = signUpSchema.parse(validSignUp);
    expect(parsed.email).toBe("aline@example.rw");
    expect(parsed.phone).toBe("+250788123456");
  });

  it("rejects short passwords with an i18n key", () => {
    const result = signUpSchema.safeParse({
      ...validSignUp,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain("validation.passwordTooShort");
  });

  it("rejects mismatched confirmation on the confirm field", () => {
    const result = signUpSchema.safeParse({
      ...validSignUp,
      confirmPassword: "something-else-entirely",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("requires the privacy notice to be accepted (PRV-002)", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, acceptPrivacy: false });
    expect(result.error?.issues[0]?.message).toBe("validation.privacyRequired");
  });
});

describe("phone normalisation", () => {
  it.each([
    ["0788123456", "+250788123456"],
    ["250788123456", "+250788123456"],
    ["+250 788 123 456", "+250788123456"],
    ["0033612345678", "+33612345678"],
  ])("%s → %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it("rejects numbers without a country code", () => {
    expect(phoneSchema.safeParse("12345").success).toBe(false);
  });
});

describe("other schemas", () => {
  it("rejects malformed emails", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("accepts recovery codes with or without dash", () => {
    expect(recoveryCodeSchema.parse("abcde-12345")).toBe("ABCDE12345");
    expect(recoveryCodeSchema.safeParse("abc").success).toBe(false);
  });

  it("discriminates two-step input", () => {
    expect(twoStepSchema.safeParse({ kind: "code", code: "123456" }).success).toBe(true);
    expect(twoStepSchema.safeParse({ kind: "code", code: "12345" }).success).toBe(false);
  });
});

describe("estimatePasswordStrength", () => {
  it("scores weak to strong", () => {
    expect(estimatePasswordStrength("abc")).toBe(0);
    expect(estimatePasswordStrength("password1234")).toBe(1);
    expect(estimatePasswordStrength("Tr0ub4dour&3xy")).toBeGreaterThanOrEqual(3);
    expect(estimatePasswordStrength("a-very-long-passphrase-for-rebp")).toBeGreaterThanOrEqual(3);
  });
});
