import "server-only";
import type { VerificationPurpose } from "@/generated/prisma/enums";
import { db } from "../db";
import { AppError } from "../errors";
import { hmac, numericCode, safeEqual } from "./crypto";

export const CODE_TTL_MS = 10 * 60_000;
export const CODE_MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 30_000;

interface IssueOptions {
  purpose: VerificationPurpose;
  target: string;
  userId?: string | null;
  context?: string | null;
}

interface IssueBehaviour {
  /** Throttle resends; disabled for the first code of a new flow. */
  enforceCooldown?: boolean;
}

const digest = (id: string, code: string) => hmac(`${id}:${code}`);

/** Issues a fresh one-time code, invalidating earlier ones for the same purpose and target. */
export async function issueCode(
  { purpose, target, userId = null, context = null }: IssueOptions,
  { enforceCooldown = true }: IssueBehaviour = {},
): Promise<string> {
  const latest = await db.verificationCode.findFirst({
    where: { purpose, target, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (enforceCooldown && latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError("resendCooldown", "errors.resendCooldown", undefined, {
      retryAfterSeconds: Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) / 1000,
      ),
    });
  }
  await db.verificationCode.updateMany({
    where: { purpose, target, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const code = numericCode(6);
  const record = await db.verificationCode.create({
    data: {
      purpose,
      target,
      userId,
      context,
      codeHash: "pending",
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  await db.verificationCode.update({
    where: { id: record.id },
    data: { codeHash: digest(record.id, code) },
  });
  return code;
}

/** Consumes a code. Throws `codeInvalid` / `codeExpired` / `tooManyAttempts`. */
export async function consumeCode({
  purpose,
  target,
  code,
  context = null,
}: IssueOptions & { code: string }) {
  const record = await db.verificationCode.findFirst({
    where: { purpose, target, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record || (context !== null && record.context !== context))
    throw new AppError("codeInvalid");
  if (record.expiresAt.getTime() < Date.now()) throw new AppError("codeExpired");
  if (record.attempts >= CODE_MAX_ATTEMPTS) throw new AppError("tooManyAttempts");
  if (!safeEqual(record.codeHash, digest(record.id, code))) {
    await db.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError("codeInvalid");
  }
  // Conditional update guards against two concurrent requests consuming the same code.
  const { count } = await db.verificationCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (count === 0) throw new AppError("codeInvalid");
  return record;
}
