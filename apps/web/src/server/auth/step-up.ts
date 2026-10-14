import "server-only";
import type { Session, User } from "@/generated/prisma/client";
import { recordAudit } from "../audit/audit";
import { db } from "../db";
import { AppError } from "../errors";
import { verifyPassword } from "./password";
import type { RequestContext } from "./types";

/** SEC-005 step-up: sensitive changes need a credential presented within this window. */
export const STEP_UP_WINDOW_MS = 10 * 60_000;

export function hasRecentAuth(session: Pick<Session, "authenticatedAt">, now = Date.now()) {
  return now - session.authenticatedAt.getTime() <= STEP_UP_WINDOW_MS;
}

export function assertRecentAuth(session: Pick<Session, "authenticatedAt">) {
  if (!hasRecentAuth(session)) throw new AppError("reauthRequired");
}

export async function reauthenticate(
  user: User,
  session: Session,
  password: string,
  ctx: RequestContext,
) {
  // Accounts without a password (Google-only) re-authenticate by signing in with Google again.
  if (!user.passwordHash) throw new AppError("reauthWithGoogle");
  if (!(await verifyPassword(user.passwordHash, password))) {
    await recordAudit({
      action: "auth.reauth_failed",
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      ...ctx,
    });
    throw new AppError("invalidPassword", "errors.invalidPassword", {
      password: "errors.invalidPassword",
    });
  }
  await db.session.update({ where: { id: session.id }, data: { authenticatedAt: new Date() } });
}
