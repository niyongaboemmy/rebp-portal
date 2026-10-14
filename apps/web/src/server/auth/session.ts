import "server-only";
import { idleTimeoutMinutes, isStaff, type Role } from "@rebp/contracts";
import type { Session, User } from "@/generated/prisma/client";
import { db } from "../db";
import { randomToken, sha256 } from "./crypto";

/** Absolute lifetime (FR-ACC-010): staff 8 h, applicants 12 h. */
export function absoluteTimeoutMs(roles: readonly Role[]): number {
  return (isStaff(roles) ? 8 : 12) * 60 * 60_000;
}

/** Avoid a DB write on every request; activity is tracked at one-minute resolution. */
const TOUCH_INTERVAL_MS = 60_000;

export interface SessionWithUser {
  session: Session;
  user: User;
}

export interface NewSession {
  token: string;
  session: Session;
}

export async function createSession(
  user: Pick<User, "id" | "roles">,
  options: {
    method: "password" | "google";
    mfaVerified: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): Promise<NewSession> {
  const token = randomToken();
  const session = await db.session.create({
    data: {
      id: sha256(token),
      userId: user.id,
      method: options.method,
      mfaVerified: options.mfaVerified,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      expiresAt: new Date(Date.now() + absoluteTimeoutMs(user.roles)),
    },
  });
  return { token, session };
}

export type SessionInvalidReason = "missing" | "revoked" | "expired" | "idle" | "disabled";

/** Resolves a cookie token to a live session, enforcing revocation, absolute and idle timeouts. */
export async function validateSessionToken(
  token: string,
  now: number = Date.now(),
): Promise<SessionWithUser | { invalid: SessionInvalidReason }> {
  const found = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: true },
  });
  if (!found) return { invalid: "missing" };
  const { user, ...session } = found;
  if (session.revokedAt) return { invalid: "revoked" };
  if (user.disabledAt) return { invalid: "disabled" };
  if (session.expiresAt.getTime() <= now) return { invalid: "expired" };
  if (now - session.lastActiveAt.getTime() > idleTimeoutMinutes(user.roles) * 60_000) {
    await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date(now) } });
    return { invalid: "idle" };
  }
  if (now - session.lastActiveAt.getTime() > TOUCH_INTERVAL_MS) {
    session.lastActiveAt = new Date(now);
    await db.session.update({
      where: { id: session.id },
      data: { lastActiveAt: session.lastActiveAt },
    });
  }
  return { session, user };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** "Sign out everywhere" (FR-ACC-010); optionally keeps the current session. */
export async function revokeUserSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  const { count } = await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return count;
}

export async function listActiveSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      lastActiveAt: true,
      ipAddress: true,
      userAgent: true,
      method: true,
    },
  });
}
