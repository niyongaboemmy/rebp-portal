import "server-only";
import { capabilitiesFor, type Role, SOD_EXEMPT_ROLES } from "@rebp/contracts";
import type { User } from "@/generated/prisma/client";
import { getPermissionMatrix, userCan } from "../access/permissions";
import { asData } from "../applications/applications";
import { findLicenceByNumber } from "../applications/facts";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { getConfig } from "../config/config";
import { db } from "../db";
import { AppError } from "../errors";
import { notify } from "../notifications/inbox";

/**
 * Work assignment (WP-3.1, FR-BO-002/003/005, BR-093). Load-balanced auto-assignment among
 * reviewing officers, skipping anyone with a conflict of interest: the applicant themself, the
 * named supervisor, a member of the same firm (Section F or G), or an officer who declared a
 * conflict. Team leads (review.assign) may reassign or take over any open file, one or in bulk.
 */

/** Statuses in which a file is with the officers and may be (re)assigned. */
const ASSIGNABLE = ["SUBMITTED", "UNDER_REVIEW", "ACTION_REQUIRED", "FURTHER_ASSESSMENT"] as const;
export async function reviewers({
  auto = false,
}: {
  /** Auto-assignment: only people who review for a living, not administrators (SOD_EXEMPT_ROLES). */
  auto?: boolean;
} = {}): Promise<Array<Pick<User, "id" | "fullName">>> {
  const matrix = await getPermissionMatrix();
  const roles = (Object.keys(matrix) as Role[]).filter(
    (role) =>
      capabilitiesFor([role], matrix).includes("review.perform") &&
      !(auto && SOD_EXEMPT_ROLES.includes(role)),
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
  // FR-BO-003: the firm named in Section F (affiliation), or in Section G — the firm being
  // registered (REBF), the firm a Principal Broker will lead, and the Principal Broker named for it.
  const firmIds = new Set<string>();
  if (data.f?.firmId) firmIds.add(data.f.firmId);
  const regNos = [data.g?.companyRegNo, data.g?.proposedFirmRef].filter((v): v is string =>
    Boolean(v?.trim()),
  );
  if (regNos.length > 0) {
    const firms = await db.firm.findMany({
      where: { companyRegNo: { in: regNos.map((v) => v.trim()) } },
      select: { id: true },
    });
    for (const firm of firms) firmIds.add(firm.id);
  }
  const principal = await findLicenceByNumber(data.g?.principalBrokerLicenceNo);
  let firm = principal?.holderId === officerId;
  if (principal?.affiliatedFirmId) firmIds.add(principal.affiliatedFirmId);
  if (!firm && firmIds.size > 0) {
    const ids = [...firmIds];
    const member = await db.licence.count({
      where: {
        holderId: officerId,
        status: "ACTIVE",
        OR: [{ affiliatedFirmId: { in: ids } }, { firmId: { in: ids } }],
      },
    });
    const owner = await db.firm.count({ where: { id: { in: ids }, ownerId: officerId } });
    firm = member + owner > 0;
  }
  if (firm) reasons.push("firm");
  return reasons;
}

/** FR-BO-002: least-loaded eligible officer; ties go to whoever was assigned least recently. */
export async function autoAssign(applicationId: string) {
  const flags = await getConfig("flags");
  if (!flags.value.autoAssign) return null;
  const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.assignedOfficerId) return app.assignedOfficerId;
  const officers = await reviewers({ auto: true });
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

/**
 * Manual assign / reassign (FR-BO-002) — always subject to the conflict guard (BR-093). An officer
 * assigns unassigned work (to anyone, incl. themselves) or hands on their own file; a team lead
 * (review.assign) may also reassign or take over a colleague's file. The previous officer is told.
 */
export async function assignTo(
  applicationId: string,
  officerId: string,
  actor: User,
  ctx: RequestContext,
  { mode = "manual" }: { mode?: "manual" | "bulk" } = {},
) {
  const app = await db.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new AppError("notFound");
  if (!(ASSIGNABLE as readonly string[]).includes(app.status))
    throw new AppError("invalidTransition");
  const lead = await userCan(actor, "review.assign");
  if (!lead) {
    // M3: no taking over a colleague's file without the lead's capability.
    if (!(await userCan(actor, "review.perform"))) throw new AppError("forbidden");
    if (app.assignedOfficerId && app.assignedOfficerId !== actor.id)
      throw new AppError("notAssigned");
  }
  // Anyone who may review (incl. administrators, SOD_EXEMPT_ROLES) can be given a file by hand.
  const officers = await reviewers();
  if (!officers.some((o) => o.id === officerId)) throw new AppError("notAReviewer");
  if (app.assignedOfficerId === officerId) return { reference: app.referenceNo, changed: false };
  const conflicts = await conflictsFor(applicationId, officerId);
  if (conflicts.length > 0)
    throw new AppError("conflictOfInterest", "errors.conflictOfInterest", undefined, {
      reasons: conflicts.join(","),
    });
  const previous = app.assignedOfficerId;
  // Optimistic: a concurrent reassignment makes this one fail rather than silently win.
  const { count } = await db.application.updateMany({
    where: { id: applicationId, assignedOfficerId: previous },
    data: { assignedOfficerId: officerId, assignedAt: new Date() },
  });
  if (count === 0) throw new AppError("staleState");
  const takeover = Boolean(previous && previous !== actor.id);
  await recordAudit({
    action: "application.assigned",
    entityType: "Application",
    entityId: applicationId,
    actorId: actor.id,
    metadata: {
      reference: app.referenceNo,
      officerId,
      previousOfficerId: previous,
      mode: takeover ? "takeover" : mode,
    },
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
  if (takeover && previous !== officerId)
    await notify(previous!, {
      code: "N-030",
      messageKey: "reassigned",
      values: { reference: app.referenceNo, name: actor.fullName },
      href: `/backoffice/review/${applicationId}`,
    });
  return { reference: app.referenceNo, changed: true };
}

export interface BulkAssignResult {
  assigned: string[];
  /** Files left as they were, with the reason (an i18n key) and any conflict reasons. */
  skipped: Array<{ reference: string; error: string; reasons: string[] }>;
}

/**
 * FR-BO-005: assign several files to one officer in one action. Leads (review.assign) assign to
 * anyone; officers (review.perform) may only take unassigned files themselves. Every file goes
 * through assignTo (conflict guard, audit, N-030); per-file failures are reported, not fatal.
 */
export async function bulkAssign(
  applicationIds: readonly string[],
  officerId: string,
  actor: User,
  ctx: RequestContext,
): Promise<BulkAssignResult> {
  const lead = await userCan(actor, "review.assign");
  if (!lead && (officerId !== actor.id || !(await userCan(actor, "review.perform"))))
    throw new AppError("forbidden");
  const apps = await db.application.findMany({
    where: { id: { in: [...new Set(applicationIds)] } },
    select: { id: true, referenceNo: true },
  });
  const result: BulkAssignResult = { assigned: [], skipped: [] };
  for (const app of apps) {
    try {
      await assignTo(app.id, officerId, actor, ctx, { mode: "bulk" });
      result.assigned.push(app.referenceNo);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      result.skipped.push({
        reference: app.referenceNo,
        error: error.message,
        reasons: String(error.meta?.reasons ?? "")
          .split(",")
          .filter(Boolean),
      });
    }
  }
  return result;
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
