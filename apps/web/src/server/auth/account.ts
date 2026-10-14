import "server-only";
import type { SignUpInput } from "@rebp/contracts";
import { signUpSchema } from "@rebp/contracts";
import type { User } from "@/generated/prisma/client";
import { maskEmail, maskPhone, recordAudit } from "../audit/audit";
import { db } from "../db";
import { AppError } from "../errors";
import { sendEmail, sendSms } from "../notifications";
import { checkPasswordPolicy, hashPassword } from "./password";
import { createSession } from "./session";
import type { ContactChannel, RequestContext } from "./types";
import { consumeCode, issueCode } from "./verification";

/** FR-ACC-001…003: create an account, open a session, and send both verification codes. */
export async function signUp(raw: SignUpInput, ctx: RequestContext) {
  const input = signUpSchema.parse(raw);

  const [emailOwner, phoneOwner] = await Promise.all([
    db.user.findUnique({ where: { email: input.email }, select: { id: true } }),
    db.user.findUnique({ where: { phone: input.phone }, select: { id: true } }),
  ]);
  const fieldErrors: Record<string, string> = {};
  // FR-ACC-003: on a match, point to recovery instead of creating a duplicate.
  if (emailOwner) fieldErrors.email = "errors.emailTaken";
  if (phoneOwner) fieldErrors.phone = "errors.phoneTaken";
  if (Object.keys(fieldErrors).length)
    throw new AppError("duplicateAccount", "errors.duplicateAccount", fieldErrors);

  const problem = await checkPasswordPolicy(input.password, {
    email: input.email,
    fullName: input.fullName,
  });
  if (problem)
    throw new AppError(problem, `validation.${problem}`, { password: `validation.${problem}` });

  const user = await db.user.create({
    data: {
      accountType: input.accountType,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: new Date(),
      roles: ["APPLICANT"],
    },
  });

  await recordAudit({
    action: "account.created",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...ctx,
    metadata: { accountType: user.accountType, email: maskEmail(user.email), method: "password" },
  });

  await Promise.all([sendContactCode(user, "EMAIL", false), sendContactCode(user, "PHONE", false)]);
  const { token, session } = await createSession(user, {
    method: "password",
    mfaVerified: false,
    ...ctx,
  });
  return { user, token, expiresAt: session.expiresAt };
}

export function isFullyVerified(user: Pick<User, "emailVerifiedAt" | "phoneVerifiedAt">) {
  return Boolean(user.emailVerifiedAt && user.phoneVerifiedAt);
}

export async function sendContactCode(user: User, channel: ContactChannel, enforceCooldown = true) {
  if (channel === "EMAIL") {
    if (user.emailVerifiedAt) throw new AppError("alreadyVerified");
    const code = await issueCode(
      { purpose: "EMAIL_VERIFY", target: user.email, userId: user.id },
      { enforceCooldown },
    );
    await sendEmail(user.email, "emailVerify", { code, name: user.fullName }, user);
    return;
  }
  if (!user.phone) throw new AppError("phoneMissing");
  if (user.phoneVerifiedAt) throw new AppError("alreadyVerified");
  const code = await issueCode(
    { purpose: "PHONE_VERIFY", target: user.phone, userId: user.id },
    { enforceCooldown },
  );
  await sendSms(user.phone, "phoneVerify", { code }, user);
}

export async function verifyContact(
  user: User,
  channel: ContactChannel,
  code: string,
  ctx: RequestContext,
) {
  const target = channel === "EMAIL" ? user.email : user.phone;
  if (!target) throw new AppError("phoneMissing");
  await consumeCode({
    purpose: channel === "EMAIL" ? "EMAIL_VERIFY" : "PHONE_VERIFY",
    target,
    code,
  });
  const updated = await db.user.update({
    where: { id: user.id },
    data: channel === "EMAIL" ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
  });
  await recordAudit({
    action: channel === "EMAIL" ? "account.email_verified" : "account.phone_verified",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...ctx,
  });
  return updated;
}

/** FR-ACC-008: a new phone must be re-verified; the change is audited and the user notified. */
export async function updatePhone(user: User, phone: string, ctx: RequestContext) {
  if (user.mfaMethods.includes("SMS")) throw new AppError("disableSmsFirst");
  if (phone === user.phone) return user;
  const owner = await db.user.findUnique({ where: { phone }, select: { id: true } });
  if (owner) throw new AppError("phoneTaken", "errors.phoneTaken", { phone: "errors.phoneTaken" });

  const updated = await db.user.update({
    where: { id: user.id },
    data: { phone, phoneVerifiedAt: null },
  });
  await recordAudit({
    action: "account.phone_changed",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...ctx,
    metadata: { from: user.phone ? maskPhone(user.phone) : null, to: maskPhone(phone) },
  });
  await sendEmail(user.email, "contactChanged", { name: user.fullName }, user);
  await sendContactCode(updated, "PHONE", false);
  return updated;
}
