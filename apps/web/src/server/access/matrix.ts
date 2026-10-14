import "server-only";
import {
  applyOverrides,
  DEFAULT_PERMISSIONS,
  diffMatrix,
  matrixChangesSchema,
  validateMatrix,
} from "@rebp/contracts";
import type { z } from "zod";
import type { User } from "@/generated/prisma/client";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { db } from "../db";
import { AppError } from "../errors";
import { getPermissionMatrix, invalidatePermissionCache } from "./permissions";

/**
 * Applies cell changes to the live matrix. The whole resulting matrix must pass the contracts
 * guard-rails (segregation of duties, maker-checker, lock-out, staff-only) or nothing is saved.
 */
export async function saveMatrixChanges(
  actor: User,
  raw: z.input<typeof matrixChangesSchema>,
  ctx: RequestContext,
) {
  const { changes } = matrixChangesSchema.parse(raw);
  const current = await getPermissionMatrix();
  const next = applyOverrides(changes, current);

  const violations = validateMatrix(next);
  if (violations.length > 0)
    throw new AppError("matrixInvalid", "errors.matrixInvalid", undefined, { violations });

  const effective = diffMatrix(current, next);
  if (effective.length === 0) return { changed: 0 };

  // Persist only the cells that differ from the code defaults.
  const overrides = diffMatrix(DEFAULT_PERMISSIONS, next);
  await db.$transaction([
    db.rolePermission.deleteMany({}),
    db.rolePermission.createMany({ data: overrides.map((o) => ({ ...o, updatedById: actor.id })) }),
  ]);
  invalidatePermissionCache();
  await recordAudit({
    action: "access.permissions_changed",
    entityType: "PermissionMatrix",
    actorId: actor.id,
    ...ctx,
    metadata: { changes: effective },
  });
  return { changed: effective.length };
}

/** Removes every override, restoring the SRS Appendix D defaults. */
export async function resetMatrix(actor: User, ctx: RequestContext) {
  const { count } = await db.rolePermission.deleteMany({});
  invalidatePermissionCache();
  if (count > 0) {
    await recordAudit({
      action: "access.permissions_reset",
      entityType: "PermissionMatrix",
      actorId: actor.id,
      ...ctx,
      metadata: { count },
    });
  }
  return { reset: count };
}
