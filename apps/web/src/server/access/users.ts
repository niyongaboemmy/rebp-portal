import "server-only";
import {
  assignmentWarnings,
  isStaff,
  ROLES,
  setUserStatusSchema,
  updateUserRolesSchema,
  type Role,
  type UserQuery,
} from "@rebp/contracts";
import type { z } from "zod";
import type { Prisma, User } from "@/generated/prisma/client";
import { maskEmail, recordAudit } from "../audit/audit";
import { revokeUserSessions } from "../auth/session";
import type { RequestContext } from "../auth/types";
import { db } from "../db";
import { AppError } from "../errors";
import { sendEmail } from "../notifications";
import { getPermissionMatrix } from "./permissions";

export const USERS_PAGE_SIZE = 12;

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  accountType: "INDIVIDUAL" | "ORGANISATION";
  roles: Role[];
  mfaMethods: string[];
  verified: boolean;
  disabled: boolean;
  disabledReason: string | null;
  lastSignInAt: string | null;
  createdAt: string;
}

function toRow(user: User): UserRow {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    accountType: user.accountType,
    roles: user.roles,
    mfaMethods: user.mfaMethods,
    verified: Boolean(user.emailVerifiedAt && user.phoneVerifiedAt),
    disabled: Boolean(user.disabledAt),
    disabledReason: user.disabledReason,
    lastSignInAt: user.lastSignInAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Paginated people directory with search and filters (SEC-011 access review). */
export async function listUsers(query: UserQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.q
      ? {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.role ? { roles: { has: query.role } } : {}),
    ...(query.status === "active" ? { disabledAt: null } : {}),
    ...(query.status === "disabled" ? { disabledAt: { not: null } } : {}),
    ...(query.status === "noMfa" ? { mfaMethods: { isEmpty: true } } : {}),
  };
  const total = await db.user.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const page = Math.min(query.page ?? 1, pageCount);
  const users = await db.user.findMany({
    where,
    orderBy: [{ disabledAt: { sort: "asc", nulls: "first" } }, { fullName: "asc" }],
    skip: (page - 1) * USERS_PAGE_SIZE,
    take: USERS_PAGE_SIZE,
  });
  return { items: users.map(toRow), total, page, pageCount };
}

/** Number of people holding each role (for the role cards). */
export async function roleCounts(): Promise<Record<Role, number>> {
  const rows = await db.$queryRaw<{ role: string; count: bigint }[]>`
    SELECT unnest(roles)::text AS role, count(*) AS count FROM "User" GROUP BY 1`;
  const counts = Object.fromEntries(ROLES.map((role) => [role, 0])) as Record<Role, number>;
  for (const row of rows) if (row.role in counts) counts[row.role as Role] = Number(row.count);
  return counts;
}

async function otherActiveAdmins(excludingUserId: string) {
  return db.user.count({
    where: { id: { not: excludingUserId }, roles: { has: "SYSTEM_ADMIN" }, disabledAt: null },
  });
}

async function loadTarget(actor: User, userId: string) {
  // Self-service changes to one's own access are refused: no self-escalation, no self-lock-out.
  if (actor.id === userId) throw new AppError("cannotEditOwnAccess");
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) throw new AppError("userNotFound");
  return target;
}

export async function updateUserRoles(
  actor: User,
  raw: z.input<typeof updateUserRolesSchema>,
  ctx: RequestContext,
) {
  const input = updateUserRolesSchema.parse(raw);
  const target = await loadTarget(actor, input.userId);
  const roles = ROLES.filter((role) => input.roles.includes(role));

  if (target.accountType === "ORGANISATION" && isStaff(roles))
    throw new AppError("staffRoleOnOrganisation");
  if (
    target.roles.includes("SYSTEM_ADMIN") &&
    !roles.includes("SYSTEM_ADMIN") &&
    (await otherActiveAdmins(target.id)) === 0
  ) {
    throw new AppError("lastAdmin");
  }

  const added = roles.filter((r) => !target.roles.includes(r));
  const removed = target.roles.filter((r) => !roles.includes(r));
  if (added.length === 0 && removed.length === 0) return { user: toRow(target), warnings: [] };

  const updated = await db.user.update({ where: { id: target.id }, data: { roles } });
  await recordAudit({
    action: "access.roles_changed",
    entityType: "User",
    entityId: target.id,
    actorId: actor.id,
    ...ctx,
    metadata: { added, removed, email: maskEmail(target.email) },
  });
  await sendEmail(target.email, "accessChanged", { name: target.fullName }, target);

  const warnings = assignmentWarnings(roles, {
    matrix: await getPermissionMatrix(),
    hasMfa: updated.mfaMethods.length > 0,
    accountType: updated.accountType,
  });
  return { user: toRow(updated), warnings };
}

/** SEC-011 leaver process: disabling blocks sign-in and ends every session at once. */
export async function setUserDisabled(
  actor: User,
  raw: z.input<typeof setUserStatusSchema>,
  ctx: RequestContext,
) {
  const input = setUserStatusSchema.parse(raw);
  const target = await loadTarget(actor, input.userId);
  if (
    input.disabled &&
    target.roles.includes("SYSTEM_ADMIN") &&
    (await otherActiveAdmins(target.id)) === 0
  ) {
    throw new AppError("lastAdmin");
  }
  if (Boolean(target.disabledAt) === input.disabled) return toRow(target);

  const updated = await db.user.update({
    where: { id: target.id },
    data: input.disabled
      ? { disabledAt: new Date(), disabledReason: input.reason || null }
      : { disabledAt: null, disabledReason: null, failedLoginCount: 0, lockedUntil: null },
  });
  if (input.disabled) await revokeUserSessions(target.id);
  await recordAudit({
    action: input.disabled ? "access.account_disabled" : "access.account_enabled",
    entityType: "User",
    entityId: target.id,
    actorId: actor.id,
    ...ctx,
    metadata: { reason: input.reason ?? null },
  });
  return toRow(updated);
}
