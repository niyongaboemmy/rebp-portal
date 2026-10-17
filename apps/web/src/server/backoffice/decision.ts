import "server-only";
import { sectionsFor, buildChecklist, type DecisionInput, decisionSchema } from "@rebp/contracts";
import type { Session, User } from "@/generated/prisma/client";
import { asData, auditTransition, transition } from "../applications/applications";
import { findLicenceByNumber } from "../applications/facts";
import { nextSequence } from "../applications/numbers";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { reauthenticate } from "../auth/step-up";
import { db } from "../db";
import { AppError } from "../errors";
import { issueLicence, notifyDecision } from "../licensing/licensing";
import { addDaysTo } from "../time";
import { conflictsFor } from "./assignment";

/**
 * Section M decision (WP-3.6, FR-M-001…017). Only an approving authority who did not review the
 * application may decide it (BR-091), never with a conflict (BR-093). Signing needs
 * re-authentication; decisions are immutable. Approval triggers licence issuance (BR-092).
 */

/** BR-091 and BR-093 checks; returns nothing or throws. */
export async function assertCanDecide(applicationId: string, approver: User) {
  // BR-091: anyone who drafted, signed or was ever assigned the review may not decide (M3).
  const reviewed = await db.review.count({
    where: {
      applicationId,
      OR: [{ officerId: approver.id }, { signature: { path: ["officerId"], equals: approver.id } }],
    },
  });
  const everAssigned = await db.auditEvent.count({
    where: {
      entityType: "Application",
      entityId: applicationId,
      action: "application.assigned",
      metadata: { path: ["officerId"], equals: approver.id },
    },
  });
  const app = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { assignedOfficerId: true },
  });
  if (reviewed > 0 || everAssigned > 0 || app.assignedOfficerId === approver.id)
    throw new AppError("segregationOfDuties");
  const conflicts = await conflictsFor(applicationId, approver.id);
  if (conflicts.length > 0)
    throw new AppError("conflictOfInterest", "errors.conflictOfInterest", undefined, {
      reasons: conflicts.join(","),
    });
}

export async function recordDecision(
  input: DecisionInput,
  approver: User,
  session: Session,
  ctx: RequestContext,
) {
  const parsed = decisionSchema.parse(input);
  const app = await db.application.findUnique({ where: { id: parsed.applicationId } });
  if (!app) throw new AppError("notFound");
  if (app.status !== "PENDING_DECISION") throw new AppError("invalidTransition");
  await assertCanDecide(app.id, approver);
  const approval = parsed.decision === "APPROVED" || parsed.decision === "APPROVED_WITH_CONDITIONS";
  // FR-M-004 (pilot): the approved category is the category applied for.
  if (parsed.approvedCategory && parsed.approvedCategory !== app.category)
    throw new AppError("categoryChangeNotAllowed");
  // FR-FIRM-011 / BR-032: a firm licence needs an approved, active Principal Broker.
  if (approval && app.category === "REBF") {
    const principal = await findLicenceByNumber(asData(app.data).g?.principalBrokerLicenceNo);
    if (!principal || principal.category !== "PRINCIPAL_BROKER" || principal.status !== "ACTIVE")
      throw new AppError("principalNotApproved");
  }

  await reauthenticate(approver, session, parsed.password, ctx);
  const signedAt = new Date();
  const letterNo = `DL-${signedAt.getUTCFullYear()}-${String(await nextSequence("letter_seq")).padStart(6, "0")}`;
  const decision = await db.$transaction(async (tx) => {
    const created = await tx.decision.create({
      data: {
        applicationId: app.id,
        approverId: approver.id,
        decision: parsed.decision,
        approvedCategory: approval ? app.category : null,
        conditions: parsed.conditions as object[],
        geoScope: parsed.geoScope,
        reasons: parsed.reasons ?? null,
        reasonCodes: parsed.reasonCodes,
        letterNo,
        signedAt,
        signature: {
          approverId: approver.id,
          name: approver.fullName,
          title: "Approving Authority",
          method: "PASSWORD_REAUTH",
          at: signedAt.toISOString(),
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      },
    });
    await transition(tx, app, parsed.decision, {
      actorId: approver.id,
      reason: `decision.${parsed.decision}`,
      data: { decidedAt: signedAt },
    });
    if (parsed.decision === "DEFERRED") {
      // Deferred pending information (→ ACTION_REQUIRED): the applicant may update every section.
      const unlockedSections = [...sectionsFor(app.type, app.category)];
      const unlockedDocuments = buildChecklist({
        type: app.type,
        category: app.category,
        data: asData(app.data),
      }).map((i) => i.type);
      await transition(tx, { id: app.id, status: "DEFERRED" }, "ACTION_REQUIRED", {
        actorId: approver.id,
        reason: "deferred",
        data: { unlockedSections, unlockedDocuments, slaDueAt: addDaysTo(signedAt, 30) },
      });
    }
    return created;
  });
  await recordAudit({
    action: "decision.signed",
    entityType: "Decision",
    entityId: decision.id,
    actorId: approver.id,
    metadata: { reference: app.referenceNo, decision: parsed.decision, letterNo },
    ...ctx,
  });
  await auditTransition(app, "PENDING_DECISION", parsed.decision, approver.id, ctx);

  let licence = null;
  if (approval) {
    try {
      licence = await issueLicence(app.id, approver.id);
    } catch (error) {
      // FR-N-009: issuance is retried by the scheduled job; the approval stands.
      console.error("[decision] licence issuance failed, will retry", {
        applicationId: app.id,
        error: (error as Error).message,
      });
    }
  }
  await notifyDecision(app, decision, licence);
  return { decisionId: decision.id, licenceId: licence?.id ?? null };
}
