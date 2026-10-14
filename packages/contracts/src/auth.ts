import { z } from "zod";

/**
 * Authentication contracts (FR-ACC-001…010).
 * Error messages are i18n keys resolved by the UI (namespace "validation").
 */

export const ACCOUNT_TYPES = ["INDIVIDUAL", "ORGANISATION"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const MFA_METHODS = ["TOTP", "SMS", "EMAIL"] as const;
export type MfaMethod = (typeof MFA_METHODS)[number];

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const OTP_LENGTH = 6;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "validation.required")
  .max(254, "validation.emailInvalid")
  .email("validation.emailInvalid")
  .transform((value) => value.toLowerCase());

/**
 * Normalises a phone number to E.164. Local Rwandan numbers (07XXXXXXXX) are
 * prefixed with +250; anything else must already carry a country code.
 */
export function normalisePhone(input: string): string {
  const compact = input.replace(/[\s\-().]/g, "");
  if (/^07\d{8}$/.test(compact)) return `+250${compact.slice(1)}`;
  if (/^2507\d{8}$/.test(compact)) return `+${compact}`;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  return compact;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "validation.required")
  .transform(normalisePhone)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "validation.phoneInvalid"));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "validation.passwordTooShort")
  .max(PASSWORD_MAX_LENGTH, "validation.passwordTooLong");

export const otpSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), "validation.otpInvalid");

/** Recovery codes are shown as XXXXX-XXXXX; accept them with or without the dash. */
export const recoveryCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{10}$/, "validation.recoveryCodeInvalid"));

export const signUpSchema = z
  .object({
    accountType: z.enum(ACCOUNT_TYPES),
    fullName: z
      .string()
      .trim()
      .min(2, "validation.nameTooShort")
      .max(120, "validation.nameTooLong"),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptPrivacy: z.literal(true, { error: "validation.privacyRequired" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.passwordsMismatch",
  });
export type SignUpInput = z.input<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "validation.required").max(PASSWORD_MAX_LENGTH),
  next: z.string().optional(),
});
export type SignInInput = z.input<typeof signInSchema>;

export const twoStepSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("code"), code: otpSchema }),
  z.object({ kind: z.literal("recovery"), code: recoveryCodeSchema }),
]);
export type TwoStepInput = z.input<typeof twoStepSchema>;

export const verifyContactSchema = z.object({
  channel: z.enum(["EMAIL", "PHONE"]),
  code: otpSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: otpSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.passwordsMismatch",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.passwordsMismatch",
  });

export const confirmMfaSchema = z.object({ method: z.enum(MFA_METHODS), code: otpSchema });

export const reauthSchema = z.object({ password: z.string().min(1, "validation.required") });

export const updatePhoneSchema = z.object({ phone: phoneSchema });

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/**
 * Lightweight client-side strength estimate for the meter. The server enforces
 * the real policy (length + breached-password check).
 */
export function estimatePasswordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return password.length >= 8 ? 1 : 0;
  let score = 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes >= 3) score++;
  if (password.length >= 16) score++;
  if (password.length >= 20 || (classes === 4 && password.length >= 14)) score++;
  if (/(.)\1{3,}/.test(password) || /^(?:password|qwerty|123456)/i.test(password))
    score = Math.min(score, 1);
  return Math.min(score, 4) as PasswordStrength;
}
