import "server-only";
import { capabilitiesFor, type Capability, type Role } from "@rebp/contracts";
import { db } from "../db";
import { getPermissionMatrix } from "../access/permissions";
import { sendEvent } from "./index";

/**
 * In-app notifications plus the email/SMS fan-out of SRS Appendix C (FR-NOT-001/002). The stored
 * row holds an i18n key and values, so the bell renders in the reader's current language.
 * Delivery failures never break the business transaction that triggered them.
 */
export interface NotifyPayload {
  /** Appendix C code, e.g. "N-011". */
  code: string;
  /** Key under the "inbox" namespace: `${key}.title` / `${key}.body`. */
  messageKey: string;
  values?: Record<string, string | number>;
  href?: string;
  /** Channels besides in-app (FR-NOT-002). Regulatory notices always include email. */
  email?: boolean;
  sms?: boolean;
}

export async function notify(userId: string, payload: NotifyPayload): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phone: true, locale: true, disabledAt: true },
    });
    if (!user || user.disabledAt) return;
    const values = payload.values ?? {};
    await db.notification.create({
      data: {
        userId,
        code: payload.code,
        messageKey: payload.messageKey,
        values,
        href: payload.href ?? null,
      },
    });
    const options = { locale: user.locale, href: payload.href };
    if (payload.email) await sendEvent("EMAIL", user.email, payload.messageKey, values, options);
    if (payload.sms && user.phone)
      await sendEvent("SMS", user.phone, payload.messageKey, values, options);
  } catch (error) {
    console.error("[notify] delivery failed", {
      code: payload.code,
      error: (error as Error).message,
    });
  }
}

/** Notifies every active user whose roles grant a capability (e.g. checkers for N-100). */
export async function notifyUsersWithCapability(capability: Capability, payload: NotifyPayload) {
  const matrix = await getPermissionMatrix();
  const roles = (Object.keys(matrix) as Role[]).filter((role) =>
    capabilitiesFor([role], matrix).includes(capability),
  );
  if (roles.length === 0) return;
  const users = await db.user.findMany({
    where: { roles: { hasSome: roles }, disabledAt: null },
    select: { id: true },
  });
  for (const user of users) await notify(user.id, payload);
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function recentNotifications(userId: string, take = 20) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export async function markRead(userId: string, ids?: string[]) {
  await db.notification.updateMany({
    where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}

/** The applicant's notifications about one thing (e.g. an application), newest first (UX-028). */
export async function notificationsAbout(userId: string, fragment: string, take = 6) {
  return db.notification.findMany({
    where: { userId, href: { contains: fragment } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Links of the user's unread notifications, to badge what they're about (UX-028). */
export async function unreadLinks(userId: string) {
  const rows = await db.notification.findMany({
    where: { userId, readAt: null, href: { not: null } },
    select: { href: true },
  });
  return rows.map((r) => r.href!);
}
