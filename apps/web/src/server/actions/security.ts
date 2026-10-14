"use server";

import { revalidatePath } from "next/cache";
import {
  changePasswordSchema,
  confirmMfaSchema,
  MFA_METHODS,
  reauthSchema,
  updatePhoneSchema,
} from "@rebp/contracts";
import { z } from "zod";
import { enforceRateLimit, runAction } from "../action";
import { updatePhone } from "../auth/account";
import { getCurrentSession } from "../auth/current";
import {
  beginOtpEnrolment,
  beginTotpEnrolment,
  confirmEnrolment,
  disableMfaMethod,
  regenerateRecoveryCodes,
  setPreferredMfa,
} from "../auth/mfa";
import { unlinkGoogle } from "../auth/oauth";
import { changePassword } from "../auth/recovery";
import { revokeUserSessions } from "../auth/session";
import { assertRecentAuth, reauthenticate } from "../auth/step-up";
import { recordAudit } from "../audit/audit";
import { db } from "../db";
import { AppError } from "../errors";
import { devCodeFor } from "../notifications";
import { getRequestContext } from "../request-context";

const methodSchema = z.enum(MFA_METHODS);
const SECURITY_PATH = "/settings/security";

async function sessionOrThrow({ stepUp = false } = {}) {
  const current = await getCurrentSession();
  if (!current) throw new AppError("unauthenticated");
  if (stepUp) assertRecentAuth(current.session);
  return current;
}

export async function reauthAction(input: z.input<typeof reauthSchema>) {
  return runAction(async () => {
    await enforceRateLimit("signIn", "reauth");
    const { password } = reauthSchema.parse(input);
    const { user, session } = await sessionOrThrow();
    await reauthenticate(user, session, password, await getRequestContext());
    return null;
  });
}

export async function changePasswordAction(input: z.input<typeof changePasswordSchema>) {
  return runAction(async () => {
    const { user, session } = await sessionOrThrow();
    await changePassword(user, session, input, await getRequestContext());
    revalidatePath(SECURITY_PATH);
    return null;
  });
}

export async function beginTotpAction() {
  return runAction(async () => {
    const { user } = await sessionOrThrow({ stepUp: true });
    const { secret, qrDataUrl } = await beginTotpEnrolment(user);
    return { secret, qrDataUrl };
  });
}

export async function beginOtpEnrolmentAction(method: "SMS" | "EMAIL") {
  return runAction(async () => {
    await enforceRateLimit("otpSend", "enrol");
    const { user } = await sessionOrThrow({ stepUp: true });
    const parsed = z.enum(["SMS", "EMAIL"]).parse(method);
    await beginOtpEnrolment(user, parsed);
    return {
      devCode: await devCodeFor(parsed === "SMS" ? user.phone : user.email, "mfaEnrolCode"),
    };
  });
}

export async function confirmEnrolmentAction(input: z.input<typeof confirmMfaSchema>) {
  return runAction(async () => {
    await enforceRateLimit("otpVerify", "enrol");
    const { method, code } = confirmMfaSchema.parse(input);
    const { user, session } = await sessionOrThrow({ stepUp: true });
    const result = await confirmEnrolment(user, session, method, code, await getRequestContext());
    revalidatePath(SECURITY_PATH);
    return { recoveryCodes: result.recoveryCodes ?? null };
  });
}

export async function disableMfaAction(method: string) {
  return runAction(async () => {
    const { user } = await sessionOrThrow({ stepUp: true });
    await disableMfaMethod(user, methodSchema.parse(method), await getRequestContext());
    revalidatePath(SECURITY_PATH);
    return null;
  });
}

export async function setPreferredMfaAction(method: string) {
  return runAction(async () => {
    const { user } = await sessionOrThrow();
    await setPreferredMfa(user, methodSchema.parse(method), await getRequestContext());
    revalidatePath(SECURITY_PATH);
    return null;
  });
}

export async function regenerateRecoveryCodesAction() {
  return runAction(async () => {
    const { user } = await sessionOrThrow({ stepUp: true });
    if (user.mfaMethods.length === 0) throw new AppError("methodNotEnabled");
    const codes = await regenerateRecoveryCodes(user.id, await getRequestContext());
    revalidatePath(SECURITY_PATH);
    return { recoveryCodes: codes };
  });
}

export async function revokeSessionAction(sessionId: string) {
  return runAction(async () => {
    const { user, session } = await sessionOrThrow();
    if (sessionId === session.id) throw new AppError("cannotRevokeCurrent");
    const { count } = await db.session.updateMany({
      where: { id: sessionId, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count > 0) {
      await recordAudit({
        action: "auth.session_revoked",
        entityType: "User",
        entityId: user.id,
        actorId: user.id,
        ...(await getRequestContext()),
      });
    }
    revalidatePath(SECURITY_PATH);
    return null;
  });
}

export async function revokeOtherSessionsAction() {
  return runAction(async () => {
    const { user, session } = await sessionOrThrow();
    const count = await revokeUserSessions(user.id, session.id);
    await recordAudit({
      action: "auth.sessions_revoked",
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      ...(await getRequestContext()),
      metadata: { count },
    });
    revalidatePath(SECURITY_PATH);
    return { count };
  });
}

export async function unlinkGoogleAction() {
  return runAction(async () => {
    const { user } = await sessionOrThrow({ stepUp: true });
    await unlinkGoogle(user.id, await getRequestContext());
    revalidatePath(SECURITY_PATH);
    return null;
  });
}

export async function updatePhoneAction(input: z.input<typeof updatePhoneSchema>) {
  return runAction(async () => {
    const { phone } = updatePhoneSchema.parse(input);
    const { user } = await sessionOrThrow({ stepUp: true });
    const updated = await updatePhone(user, phone, await getRequestContext());
    return { phone: updated.phone, devCode: await devCodeFor(updated.phone, "phoneVerify") };
  });
}
