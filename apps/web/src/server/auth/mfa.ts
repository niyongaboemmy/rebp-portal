import "server-only";
import QRCode from "qrcode";
import { requiresMfa, type MfaMethod } from "@rebp/contracts";
import type { Session, User } from "@/generated/prisma/client";
import { recordAudit } from "../audit/audit";
import { db } from "../db";
import { AppError } from "../errors";
import { sendEmail, sendSms } from "../notifications";
import { decrypt, encrypt, hmac } from "./crypto";
import { generateTotpSecret, timeStep, totpUri, verifyTotp } from "./totp";
import type { RequestContext } from "./types";
import { consumeCode, issueCode } from "./verification";

export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join("");
}

export function formatRecoveryCode(code: string) {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** Replaces all recovery codes. Plaintext codes are returned once and never stored. */
export async function regenerateRecoveryCodes(
  userId: string,
  ctx?: RequestContext,
): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({ data: codes.map((code) => ({ userId, codeHash: hmac(code) })) }),
  ]);
  if (ctx)
    await recordAudit({
      action: "mfa.recovery_codes_regenerated",
      entityType: "User",
      entityId: userId,
      actorId: userId,
      ...ctx,
    });
  return codes.map(formatRecoveryCode);
}

export async function remainingRecoveryCodes(userId: string) {
  return db.recoveryCode.count({ where: { userId, usedAt: null } });
}

/** Step 1 of authenticator enrolment: a pending secret plus a QR code for the app to scan. */
export async function beginTotpEnrolment(user: User) {
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: user.id }, data: { totpPendingSecretEnc: encrypt(secret) } });
  const uri = totpUri(secret, user.email);
  const qrDataUrl = await QRCode.toDataURL(uri, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });
  return { secret, uri, qrDataUrl };
}

/** Step 1 of SMS / email enrolment: prove the channel works by sending a code to it. */
export async function beginOtpEnrolment(user: User, method: Exclude<MfaMethod, "TOTP">) {
  if (method === "SMS") {
    if (!user.phone || !user.phoneVerifiedAt) throw new AppError("phoneNotVerified");
    const code = await issueCode({
      purpose: "MFA_ENROL",
      target: user.phone,
      userId: user.id,
      context: method,
    });
    await sendSms(user.phone, "mfaEnrolCode", { code }, user);
  } else {
    const code = await issueCode({
      purpose: "MFA_ENROL",
      target: user.email,
      userId: user.id,
      context: method,
    });
    await sendEmail(user.email, "mfaEnrolCode", { code, name: user.fullName }, user);
  }
}

export interface EnrolmentResult {
  user: User;
  /** Present when this is the first factor: the user must store them now. */
  recoveryCodes?: string[];
}

/** Step 2 of any enrolment: confirm the code, enable the method, mark the session as MFA-verified. */
export async function confirmEnrolment(
  user: User,
  session: Session,
  method: MfaMethod,
  code: string,
  ctx: RequestContext,
): Promise<EnrolmentResult> {
  if (user.mfaMethods.includes(method)) throw new AppError("methodAlreadyEnabled");

  const data: Parameters<typeof db.user.update>[0]["data"] = {};
  if (method === "TOTP") {
    if (!user.totpPendingSecretEnc) throw new AppError("enrolmentExpired");
    const secret = decrypt(user.totpPendingSecretEnc);
    const counter = verifyTotp(secret, code);
    if (counter === null) throw new AppError("codeInvalid");
    Object.assign(data, {
      totpSecretEnc: user.totpPendingSecretEnc,
      totpPendingSecretEnc: null,
      totpLastCounter: counter,
    });
  } else {
    const target = method === "SMS" ? user.phone : user.email;
    await consumeCode({ purpose: "MFA_ENROL", target: target ?? "", code, context: method });
  }

  const isFirst = user.mfaMethods.length === 0;
  const updated = await db.user.update({
    where: { id: user.id },
    data: { ...data, mfaMethods: { push: method }, mfaPreferred: user.mfaPreferred ?? method },
  });
  await db.session.update({ where: { id: session.id }, data: { mfaVerified: true } });
  await recordAudit({
    action: "mfa.enabled",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...ctx,
    metadata: { method },
  });
  await sendEmail(user.email, "mfaChanged", { name: user.fullName }, user);

  return {
    user: updated,
    recoveryCodes: isFirst ? await regenerateRecoveryCodes(user.id) : undefined,
  };
}

export async function setPreferredMfa(user: User, method: MfaMethod, ctx: RequestContext) {
  if (!user.mfaMethods.includes(method)) throw new AppError("methodNotEnabled");
  await db.user.update({ where: { id: user.id }, data: { mfaPreferred: method } });
  await recordAudit({
    action: "mfa.preferred_changed",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...ctx,
    metadata: { method },
  });
}

/** Removes a method. The last method cannot be removed where MFA is mandatory (FR-ACC-004). */
export async function disableMfaMethod(user: User, method: MfaMethod, ctx: RequestContext) {
  if (!user.mfaMethods.includes(method)) throw new AppError("methodNotEnabled");
  const remaining = user.mfaMethods.filter((m) => m !== method);
  if (remaining.length === 0 && requiresMfa(user.roles)) throw new AppError("mfaRequiredForRole");

  await db.user.update({
    where: { id: user.id },
    data: {
      mfaMethods: remaining,
      mfaPreferred:
        remaining.length === 0
          ? null
          : user.mfaPreferred === method
            ? remaining[0]
            : user.mfaPreferred,
      ...(method === "TOTP" ? { totpSecretEnc: null, totpLastCounter: null } : {}),
    },
  });
  if (remaining.length === 0) await db.recoveryCode.deleteMany({ where: { userId: user.id } });
  await recordAudit({
    action: "mfa.disabled",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...ctx,
    metadata: { method },
  });
  await sendEmail(user.email, "mfaChanged", { name: user.fullName }, user);
}

/** Current TOTP step, exposed for tests and diagnostics. */
export const currentTimeStep = () => timeStep();
