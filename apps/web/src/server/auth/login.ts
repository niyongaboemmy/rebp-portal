import "server-only";
import type { MfaMethod } from "@rebp/contracts";
import { signInSchema, twoStepSchema, type SignInInput, type TwoStepInput } from "@rebp/contracts";
import type { LoginChallenge, User } from "@/generated/prisma/client";
import { maskEmail, recordAudit } from "../audit/audit";
import { db } from "../db";
import { AppError } from "../errors";
import { sendEmail, sendSms } from "../notifications";
import { decrypt, hmac, randomToken, safeEqual, sha256 } from "./crypto";
import { dummyVerify, verifyPassword } from "./password";
import { createSession } from "./session";
import { verifyTotp } from "./totp";
import type { LoginOutcome, RequestContext } from "./types";
import { consumeCode, issueCode } from "./verification";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60_000;
export const CHALLENGE_TTL_MS = 10 * 60_000;
export const CHALLENGE_MAX_ATTEMPTS = 5;

/** FR-ACC-004 / SEC-006: password sign-in with lockout and no user enumeration. */
export async function signInWithPassword(
  raw: SignInInput,
  ctx: RequestContext,
): Promise<LoginOutcome> {
  const input = signInSchema.parse(raw);
  const user = await db.user.findUnique({ where: { email: input.email } });

  if (!user || !user.passwordHash) {
    await dummyVerify(input.password);
    throw new AppError("invalidCredentials");
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new AppError("accountLocked", "errors.accountLocked", undefined, {
      retryAfterSeconds: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000),
    });
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const failed = user.failedLoginCount + 1;
    const locked = failed >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: locked ? 0 : failed,
        lockedUntil: locked ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    await recordAudit({
      action: locked ? "auth.locked" : "auth.signin_failed",
      entityType: "User",
      entityId: user.id,
      ...ctx,
      metadata: { email: maskEmail(user.email), attempt: failed },
    });
    throw new AppError("invalidCredentials");
  }

  return startLogin(user, "password", ctx);
}

/** Second step of every sign-in path: issue a session, or a challenge when two-step is on. */
export async function startLogin(
  user: User,
  method: "password" | "google",
  ctx: RequestContext,
): Promise<LoginOutcome> {
  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  if (user.mfaMethods.length === 0) {
    const { token, session } = await createSession(user, { method, mfaVerified: false, ...ctx });
    await db.user.update({ where: { id: user.id }, data: { lastSignInAt: new Date() } });
    await recordAudit({
      action: "auth.signin",
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      ...ctx,
      metadata: { method },
    });
    return { kind: "session", token, expiresAt: session.expiresAt, user };
  }

  const activeMfa =
    user.mfaPreferred && user.mfaMethods.includes(user.mfaPreferred)
      ? user.mfaPreferred
      : user.mfaMethods[0]!;
  const challengeToken = randomToken();
  const challenge = await db.loginChallenge.create({
    data: {
      id: sha256(challengeToken),
      userId: user.id,
      method,
      activeMfa,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
  await sendChallengeCode(user, challenge, false);
  await recordAudit({
    action: "auth.mfa_challenged",
    entityType: "User",
    entityId: user.id,
    ...ctx,
    metadata: { method, mfa: activeMfa },
  });
  return {
    kind: "mfa",
    challengeToken,
    expiresAt: challenge.expiresAt,
    method: activeMfa,
    methods: user.mfaMethods,
  };
}

async function sendChallengeCode(user: User, challenge: LoginChallenge, enforceCooldown = true) {
  if (challenge.activeMfa === "TOTP") return;
  const target = challenge.activeMfa === "SMS" ? user.phone : user.email;
  if (!target) throw new AppError("phoneMissing");
  const code = await issueCode(
    { purpose: "MFA_LOGIN", target, userId: user.id, context: challenge.id },
    { enforceCooldown },
  );
  if (challenge.activeMfa === "SMS") await sendSms(target, "mfaLoginCode", { code }, user);
  else await sendEmail(target, "mfaLoginCode", { code, name: user.fullName }, user);
}

async function loadChallenge(token: string) {
  const challenge = await db.loginChallenge.findUnique({
    where: { id: sha256(token) },
    include: { user: true },
  });
  if (!challenge || challenge.consumedAt) throw new AppError("challengeExpired");
  if (challenge.expiresAt.getTime() < Date.now()) throw new AppError("challengeExpired");
  if (challenge.attempts >= CHALLENGE_MAX_ATTEMPTS) throw new AppError("tooManyAttempts");
  return challenge;
}

export async function describeChallenge(token: string) {
  const { user, activeMfa } = await loadChallenge(token);
  return {
    method: activeMfa,
    methods: user.mfaMethods,
    destination: activeMfa === "SMS" ? user.phone : activeMfa === "EMAIL" ? user.email : null,
  };
}

export async function switchChallengeMethod(token: string, method: MfaMethod) {
  const challenge = await loadChallenge(token);
  if (!challenge.user.mfaMethods.includes(method)) throw new AppError("methodNotEnabled");
  const updated = await db.loginChallenge.update({
    where: { id: challenge.id },
    data: { activeMfa: method },
  });
  await sendChallengeCode(challenge.user, updated, false);
}

export async function resendChallengeCode(token: string) {
  const challenge = await loadChallenge(token);
  await sendChallengeCode(challenge.user, challenge);
}

/** Completes two-step sign-in with an authenticator/SMS/email code or a recovery code. */
export async function verifyChallenge(
  token: string,
  raw: TwoStepInput,
  ctx: RequestContext,
): Promise<LoginOutcome> {
  const input = twoStepSchema.parse(raw);
  const challenge = await loadChallenge(token);
  const { user } = challenge;

  let ok = false;
  let factor: string = challenge.activeMfa;
  try {
    if (input.kind === "recovery") {
      factor = "RECOVERY_CODE";
      ok = await consumeRecoveryCode(user.id, input.code);
    } else if (challenge.activeMfa === "TOTP") {
      ok = await consumeTotpCode(user, input.code);
    } else {
      const target = challenge.activeMfa === "SMS" ? user.phone : user.email;
      await consumeCode({
        purpose: "MFA_LOGIN",
        target: target ?? "",
        code: input.code,
        context: challenge.id,
      });
      ok = true;
    }
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== "codeInvalid") throw error;
  }

  if (!ok) {
    await db.loginChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    await recordAudit({
      action: "auth.mfa_failed",
      entityType: "User",
      entityId: user.id,
      ...ctx,
      metadata: { factor },
    });
    throw new AppError("codeInvalid");
  }

  const { count } = await db.loginChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (count === 0) throw new AppError("challengeExpired");

  const { token: sessionToken, session } = await createSession(user, {
    method: challenge.method as "password" | "google",
    mfaVerified: true,
    ...ctx,
  });
  await db.user.update({ where: { id: user.id }, data: { lastSignInAt: new Date() } });
  await recordAudit({
    action: "auth.signin",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...ctx,
    metadata: { method: challenge.method, factor },
  });
  return { kind: "session", token: sessionToken, expiresAt: session.expiresAt, user };
}

/** Accepts a TOTP code once (replay-protected via the last accepted time-step). */
export async function consumeTotpCode(user: User, code: string): Promise<boolean> {
  if (!user.totpSecretEnc) return false;
  const counter = verifyTotp(decrypt(user.totpSecretEnc), code, {
    lastCounter: user.totpLastCounter,
  });
  if (counter === null) return false;
  const { count } = await db.user.updateMany({
    where: { id: user.id, OR: [{ totpLastCounter: null }, { totpLastCounter: { lt: counter } }] },
    data: { totpLastCounter: counter },
  });
  return count === 1;
}

async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const digest = hmac(code);
  const codes = await db.recoveryCode.findMany({ where: { userId, usedAt: null } });
  const match = codes.find((candidate) => safeEqual(candidate.codeHash, digest));
  if (!match) return false;
  const { count } = await db.recoveryCode.updateMany({
    where: { id: match.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}
