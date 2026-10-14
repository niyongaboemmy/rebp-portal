import { invalidatePermissionCache } from "@/server/access/permissions";
import { db } from "@/server/db";

/** Clears mutable tables between integration tests. AuditEvent is append-only and is left alone. */
export async function resetDatabase() {
  await db.$executeRawUnsafe(
    'TRUNCATE "Session", "OAuthAccount", "RecoveryCode", "VerificationCode", "LoginChallenge", "NotificationLog", "RolePermission", "User" CASCADE',
  );
  invalidatePermissionCache();
}

/** Reads the latest one-time code delivered to a recipient through the mock adapters. */
export async function latestCode(recipient: string, template?: string): Promise<string> {
  const message = await db.notificationLog.findFirst({
    where: { recipient, ...(template ? { template } : {}) },
    orderBy: { createdAt: "desc" },
  });
  const code = message?.body?.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`No code found for ${recipient}`);
  return code;
}

export const ctx = { ipAddress: "127.0.0.1", userAgent: "vitest" };
