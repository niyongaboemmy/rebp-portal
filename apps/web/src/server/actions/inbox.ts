"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { endAffiliationSchema, respondConfirmationSchema } from "@rebp/contracts";
import { authorizeAction } from "../access/authorize";
import { runAction } from "../action";
import { getCurrentSession } from "../auth/current";
import { respondToConfirmations } from "../confirmations/confirmations";
import { AppError } from "../errors";
import { endAffiliation } from "../firms/firms";
import { markRead, recentNotifications, unreadCount } from "../notifications/inbox";
import { getRequestContext } from "../request-context";

/** Supervisor / Principal Broker inbox (FR-FIRM-003), firm actions (FR-FIRM-005), notifications. */

export async function respondConfirmationsAction(input: z.input<typeof respondConfirmationSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("confirmation.decide", { requireMfa: "auto" });
    const parsed = respondConfirmationSchema.parse(input);
    await respondToConfirmations(
      parsed.ids,
      parsed.confirm,
      parsed.reason,
      user,
      await getRequestContext(),
    );
    revalidatePath("/confirmations");
    return null;
  });
}

export async function endAffiliationAction(input: z.input<typeof endAffiliationSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("firmRoles.manage", {
      requireMfa: "auto",
      stepUp: false,
    });
    const parsed = endAffiliationSchema.parse(input);
    await endAffiliation(
      parsed.licenceId,
      parsed.effectiveOn,
      parsed.reason,
      user,
      await getRequestContext(),
    );
    revalidatePath("/firm");
    return null;
  });
}

export async function notificationsAction() {
  return runAction(async () => {
    const current = await getCurrentSession();
    if (!current) throw new AppError("unauthenticated");
    const [items, unread] = await Promise.all([
      recentNotifications(current.user.id),
      unreadCount(current.user.id),
    ]);
    return {
      unread,
      items: items.map((n) => ({
        id: n.id,
        code: n.code,
        messageKey: n.messageKey,
        values: n.values as Record<string, string | number>,
        href: n.href,
        read: Boolean(n.readAt),
        createdAt: n.createdAt.toISOString(),
      })),
    };
  });
}

export async function markNotificationsReadAction(ids?: string[]) {
  return runAction(async () => {
    const current = await getCurrentSession();
    if (!current) throw new AppError("unauthenticated");
    await markRead(current.user.id, ids ? z.array(z.uuid()).max(100).parse(ids) : undefined);
    return null;
  });
}
