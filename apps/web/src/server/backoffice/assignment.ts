import "server-only";
import { capabilitiesFor, type Role } from "@rebp/contracts";
import type { User } from "@/generated/prisma/client";
import { getPermissionMatrix } from "../access/permissions";
import { asData } from "../applications/applications";
import { findLicenceByNumber } from "../applications/facts";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { getConfig } from "../config/config";
import { db } from "../db";
import { AppError } from "../errors";
import { notify } from "../notifications/inbox";

/**
 * Work assignment (WP-3.1, FR-BO-002/003, BR-093). Load-balanced auto-assignment among reviewing
 * officers, skipping anyone with a conflict of interest: the applicant themself, the named
 * supervisor, a member of the same firm, or an officer who declared a conflict.
 */
export async function reviewers(): Promise<Array<Pick<User, "id" | "fullName">>> {
  const matrix = await getPermissionMatrix();
  const roles = (Object.keys(matrix) as Role[]).filter((role) =>
    capabilitiesFor([role], matrix).includes("review.perform"),
  );
  return db.user.findMany({
    where: { roles: { hasSome: roles }, disabledAt: null },
    select: { id: true, fullName: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Reasons an officer may not handle an application (empty = no conflict). */
export async function conflictsFor(applicationId: string, officerId: string): Promise<string[]> {
  const app = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { applicantId: true, data: true, conflicts: { where: { officerId } } },
  });
  const reasons: string[] = [];
  if (app.applicantId === officerId) reasons.push("applicant");
  if (app.conflicts.length > 0) reasons.push("declared");
  const data = asData(app.data);
  const supervisor = await findLicenceByNumber(data.f?.supervisorLicenceNo);
  if (supervisor?.holderId === officerId) reasons.push("supervisor");
  const firmId = data.f?.firmId;
  if (firmId) {
    const member = await db.licence.count({
      where: {
        holderId: officerId,
        status: "ACTIVE",
        OR: [{ affiliatedFirmId: firmId }, { firmId }],
      },
    });
    const owner = await db.firm.count({ where: { id: firmId, ownerId: officerId } });
    if (member + owner > 0) reasons.push("firm");
  }
  return reasons;
}

/** FR-BO-002: least-loaded eligible officer; ties go to whoever was assigned least recently. */
export async function autoAssign(applicationId: string) {
  const flags = await getConfig("flags");
  if (!flags.value.autoAssign) return null;
  const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.assignedOfficerId) return app.assignedOfficerId;
  const officers = await reviewers();
  const candidates: Array<{ id: string; load: number; last: number }> = [];
  for (const officer of officers) {
    if ((await conflictsFor(applicationId, officer.id)).length > 0) continue;
    const [load, last] = await Promise.all([
      db.application.count({
        where: {
          assignedOfficerId: officer.id,
          status: { in: ["SUBMITTED", "UNDER_REVIEW", "ACTION_REQUIRED", "FURTHER_ASSESSMENT"] },
        },
      }),
      db.application.findFirst({
        where: { assignedOfficerId: officer.id },
        orderBy: { assignedAt: "desc" },
        select: { assignedAt: true },
      }),
    ]);
    candidates.push({ id: officer.id, load, last: last?.assignedAt?.getTime() ?? 0 });
  }
  candidates.sort((a, b) => a.load - b.load || a.last - b.last);
  const chosen = candidates[0];
  if (!chosen) return null;
  await db.application.update({
    where: { id: applicationId },
    data: { assignedOfficerId: chosen.id, assignedAt: new Date() },
  });
  await recordAudit({
    action: "application.assigned",
    entityType: "Application",
    entityId: applicationId,
    actorId: null,
    metadata: { reference: app.referenceNo, officerId: chosen.id, mode: "auto" },
  });
  await notify(chosen.id, {
    code: "N-030",
    messageKey: "assigned",
    values: { reference: app.referenceNo },
    href: `/backoffice/review/${applicationId}`,
    email: true,
  });
  return chosen.id;
}

/** Manual assign / reassign (FR-BO-002) — still subject to the conflict guard (BR-093). */
export async function assignTo(
  applicationId: string,
  officerId: string,
  actor: User,
  ctx: RequestContext,
) {
  const app = await db.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new AppError("notFound");
  // M3: assignment only while the file is with the officers, and no taking over a colleague's
  // file: an officer assigns unassigned work (to anyone, incl. themselves) or hands on their own.
  if (!["SUBMITTED", "UNDER_REVIEW", "ACTION_REQUIRED", "FURTHER_ASSESSMENT"].includes(app.status))
    throw new AppError("invalidTransition");
  if (app.assignedOfficerId && app.assignedOfficerId !== actor.id)
    throw new AppError("notAssigned");
  const officers = await reviewers();
  if (!officers.some((o) => o.id === officerId)) throw new AppError("notAReviewer");
  const conflicts = await conflictsFor(applicationId, officerId);
  if (conflicts.length > 0)
    throw new AppError("conflictOfInterest", "errors.conflictOfInterest", undefined, {
      reasons: conflicts.join(","),
    });
  await db.application.update({
    where: { id: applicationId },
    data: { assignedOfficerId: officerId, assignedAt: new Date() },
  });
  await recordAudit({
    action: "application.assigned",
    entityType: "Application",
    entityId: applicationId,
    actorId: actor.id,
    metadata: { reference: app.referenceNo, officerId, mode: "manual" },
    ...ctx,
  });
  if (officerId !== actor.id)
    await notify(officerId, {
      code: "N-030",
      messageKey: "assigned",
      values: { reference: app.referenceNo },
      href: `/backoffice/review/${applicationId}`,
      email: true,
    });
}

/** An officer declares a conflict and recuses; the application is reassigned (FR-BO-003). */
export async function declareConflict(
  applicationId: string,
  reason: string,
  officer: User,
  ctx: RequestContext,
) {
  const app = await db.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new AppError("notFound");
  await db.conflictDeclaration.upsert({
    where: { applicationId_officerId: { applicationId, officerId: officer.id } },
    update: { reason },
    create: { applicationId, officerId: officer.id, reason },
  });
  if (app.assignedOfficerId === officer.id)
    await db.application.update({
      where: { id: applicationId },
      data: { assignedOfficerId: null, assignedAt: null },
    });
  await recordAudit({
    action: "application.conflict_declared",
    entityType: "Application",
    entityId: applicationId,
    actorId: officer.id,
    metadata: { reference: app.referenceNo },
    ...ctx,
  });
  await autoAssign(applicationId);
}
