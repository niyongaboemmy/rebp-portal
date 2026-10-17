import "server-only";
import {
  buildChecklist,
  correctDecisionSchema,
  decisionSchema,
  sectionsFor,
  type CorrectDecisionInput,
  type DecisionInput,
} from "@rebp/contracts";
import type { User } from "@/generated/prisma/client";
import { asData, auditTransition, transition } from "../applications/applications";
import { findLicenceByNumber } from "../applications/facts";
import { nextSequence } from "../applications/numbers";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { db } from "../db";
import { AppError } from "../errors";
import { alertIssuanceFailure, issueLicence, notifyDecision } from "../licensing/licensing";
import { notify } from "../notifications/inbox";
import { addDaysTo } from "../time";
import { conflictsFor } from "./assignment";

/**
 * Section M decision (WP-3.6, FR-M-001…017). Only an approving authority who did not review the
 * application may decide it (BR-091), never with a conflict (BR-093). Signing needs
 * re-authentication; decisions are immutable (a database trigger refuses UPDATE and DELETE) and
 * corrected only by a new, linked decision (FR-M-017). Approval triggers licence issuance (BR-092).
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

export async function recordDecision(input: DecisionInput, approver: User, ctx: RequestContext) {
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
        // FR-M-009: kept only when the approver overrides the derived arrangement.
        practiceArrangement: approval ? (parsed.practiceArrangement ?? null) : null,
        reasons: parsed.reasons ?? null,
        reasonCodes: parsed.reasonCodes,
        letterNo,
        signedAt,
        signature: {
          approverId: approver.id,
          name: approver.fullName,
          title: "Approving Authority",
          method: "CONFIRMED_MFA_SESSION",
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
      // FR-N-009: issuance is retried by the scheduled job; the approval stands, and the
      // registrars are alerted.
      await alertIssuanceFailure(app, error, approver.id);
    }
  }
  await notifyDecision(app, decision, licence);
  return { decisionId: decision.id, licenceId: licence?.id ?? null };
}

/**
 * FR-M-017: correct a signed decision (e.g. a clerical error in its reasons). The original stays
 * untouched; a new decision with the same outcome, a new letter number and the correction reason
 * is linked to it (correctsId), the licence points at it, and the applicant gets the new letter.
 * Only the latest record in a chain can be corrected, by someone who may decide the file (BR-091).
 */
export async function correctDecision(
  input: CorrectDecisionInput,
  approver: User,
  ctx: RequestContext,
) {
  const parsed = correctDecisionSchema.parse(input);
  const original = await db.decision.findUnique({
    where: { id: parsed.decisionId },
    include: { application: true },
  });
  if (!original) throw new AppError("notFound");
  const newer = await db.decision.count({ where: { correctsId: original.id } });
  if (newer > 0) throw new AppError("decisionAlreadyCorrected");
  const app = original.application;
  await assertCanDecide(app.id, approver);

  const signedAt = new Date();
  const letterNo = `DL-${signedAt.getUTCFullYear()}-${String(await nextSequence("letter_seq")).padStart(6, "0")}`;
  const corrected = await db.$transaction(async (tx) => {
    const created = await tx.decision.create({
      data: {
        applicationId: app.id,
        approverId: approver.id,
        decision: original.decision,
        approvedCategory: original.approvedCategory,
        conditions: original.conditions as object[],
        geoScope: original.geoScope,
        practiceArrangement: original.practiceArrangement,
        reasons: parsed.reasons ? parsed.reasons : original.reasons,
        reasonCodes: original.reasonCodes,
        letterNo,
        signedAt,
        correctsId: original.id,
        correctionReason: parsed.reason,
        signature: {
          approverId: approver.id,
          name: approver.fullName,
          title: "Approving Authority",
          method: "CONFIRMED_MFA_SESSION",
          at: signedAt.toISOString(),
          corrects: original.letterNo,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      },
    });
    // The licence (mutable) follows the current decision record.
    await tx.licence.updateMany({
      where: { decisionId: original.id },
      data: { decisionId: created.id },
    });
    return created;
  });
  await recordAudit({
    action: "decision.corrected",
    entityType: "Decision",
    entityId: corrected.id,
    actorId: approver.id,
    metadata: {
      reference: app.referenceNo,
      letterNo,
      corrects: original.letterNo,
      correctsId: original.id,
      reason: parsed.reason,
    },
    ...ctx,
  });
  await notify(app.applicantId, {
    code:
      original.decision === "DEFERRED"
        ? "N-061"
        : original.decision === "REJECTED"
          ? "N-062"
          : "N-060",
    messageKey: "decisionCorrected",
    values: { reference: app.referenceNo, letter: letterNo, previous: original.letterNo },
    href: `/applications/${app.id}`,
    email: true,
  });
  return { decisionId: corrected.id, letterNo };
}
