import "server-only";
import { changePasswordSchema, resetPasswordSchema } from "@rebp/contracts";
import type { z } from "zod";
import type { Session, User } from "@/generated/prisma/client";
import { maskEmail, recordAudit } from "../audit/audit";
import { db } from "../db";
import { AppError } from "../errors";
import { sendEmail } from "../notifications";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "./password";
import { revokeUserSessions } from "./session";
import type { RequestContext } from "./types";
import { consumeCode, issueCode } from "./verification";

/** FR-ACC-007: always reports success so the response does not reveal whether an account exists. */
export async function requestPasswordReset(email: string, ctx: RequestContext) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return;
  try {
    const code = await issueCode({
      purpose: "PASSWORD_RESET",
      target: user.email,
      userId: user.id,
    });
    await sendEmail(user.email, "passwordReset", { code, name: user.fullName }, user);
    await recordAudit({
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id,
      ...ctx,
      metadata: { email: maskEmail(email) },
    });
  } catch (error) {
    // A cooldown must not leak existence either.
    if (!(error instanceof AppError && error.code === "resendCooldown")) throw error;
  }
}

/** Resets the password, ends every session and notifies the user (FR-ACC-007). */
export async function resetPassword(raw: z.input<typeof resetPasswordSchema>, ctx: RequestContext) {
  const input = resetPasswordSchema.parse(raw);
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AppError("codeInvalid");
  await consumeCode({ purpose: "PASSWORD_RESET", target: user.email, code: input.code });

  const problem = await checkPasswordPolicy(input.password, user);
  if (problem)
    throw new AppError(problem, `validation.${problem}`, { password: `validation.${problem}` });

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
      // Receiving the code proves control of the mailbox.
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });
  await revokeUserSessions(user.id);
  await recordAudit({
    action: "auth.password_reset",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...ctx,
  });
  await sendEmail(user.email, "passwordChanged", { name: user.fullName }, user);
}

/** Change (or first set, for Google-only accounts) the password; other sessions are signed out. */
export async function changePassword(
  user: User,
  session: Session,
  raw: z.input<typeof changePasswordSchema>,
  ctx: RequestContext,
) {
  const input = changePasswordSchema.parse(raw);
  if (user.passwordHash) {
    if (
      !input.currentPassword ||
      !(await verifyPassword(user.passwordHash, input.currentPassword))
    ) {
      throw new AppError("invalidPassword", "errors.invalidPassword", {
        currentPassword: "errors.invalidPassword",
      });
    }
  }
  const problem = await checkPasswordPolicy(input.password, user);
  if (problem)
    throw new AppError(problem, `validation.${problem}`, { password: `validation.${problem}` });

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() },
  });
  await db.session.update({ where: { id: session.id }, data: { authenticatedAt: new Date() } });
  await revokeUserSessions(user.id, session.id);
  await recordAudit({
    action: user.passwordHash ? "auth.password_changed" : "auth.password_set",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...ctx,
  });
  await sendEmail(user.email, "passwordChanged", { name: user.fullName }, user);
}
