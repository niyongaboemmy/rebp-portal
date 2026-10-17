import "server-only";
import {
  SLA,
  VERIFICATION_ITEMS,
  type EligibilityOutcome,
  type ReviewDraft,
  type VerificationItem,
  type VerificationOutcome,
  type informationRequestSchema,
} from "@rebp/contracts";
import type { z } from "zod";
import type { Application, Review, User } from "@/generated/prisma/client";
import { asData, auditTransition, transition } from "../applications/applications";
import { runEligibility, storeEligibilityRun } from "../applications/facts";
import { checklistRows } from "../applications/submission";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { db } from "../db";
import { AppError } from "../errors";
import { notify, notifyUsersWithCapability } from "../notifications/inbox";
import { addDaysTo, addWorkingDays } from "../time";
import { conflictsFor } from "./assignment";

/**
 * Section L administrative review (WP-3.3, FR-L-001…010, BR-090) and information requests
 * (WP-3.4, FR-L-007, FR-WF-002). The review is a versioned record; signing (re-authentication)
 * makes it read-only and moves the application to PENDING_DECISION.
 */

const REVIEWABLE = ["SUBMITTED", "UNDER_REVIEW", "FURTHER_ASSESSMENT"] as const;

/** Only the assigned officer may work an application, and never with a conflict (BR-093). */
export async function assertReviewer(app: Application, officer: User) {
  if (app.assignedOfficerId !== officer.id) throw new AppError("notAssigned");
  const conflicts = await conflictsFor(app.id, officer.id);
  if (conflicts.length > 0)
    throw new AppError("conflictOfInterest", "errors.conflictOfInterest", undefined, {
      reasons: conflicts.join(","),
    });
}

/** The officer opens the file: SUBMITTED → UNDER_REVIEW, with the review SLA (FR-WF-006). */
export async function startReview(applicationId: string, officer: User, ctx: RequestContext) {
  const app = await db.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new AppError("notFound");
  await assertReviewer(app, officer);
  if (app.status !== "SUBMITTED") return;
  await db.$transaction((tx) =>
    transition(tx, app, "UNDER_REVIEW", {
      actorId: officer.id,
      reason: "reviewStarted",
      data: { slaDueAt: addWorkingDays(new Date(), SLA.reviewCompleteDays) },
    }),
  );
  await auditTransition(app, "SUBMITTED", "UNDER_REVIEW", officer.id, ctx);
  await storeEligibilityRun(app.id, "REVIEW", await runEligibility(app, asData(app.data)));
  // The applicant sees the review begin (UX-032): their journey moves to "Review".
  await notify(app.applicantId, {
    code: "N-011",
    messageKey: "reviewStarted",
    values: { reference: app.referenceNo },
    href: `/applications/${app.id}`,
    email: true,
  });
}

/** Auto-computed evidence per verification item (FR-L-004) and pre-computed L.10 / L.11. */
export async function computedReview(app: Application) {
  const [eligibility, checklist, confirmations] = await Promise.all([
    runEligibility(app, asData(app.data)),
    checklistRows(app),
    db.confirmationRequest.findMany({
      where: { applicationId: app.id, status: { not: "CANCELLED" } },
    }),
  ]);
  const byRule = (ids: string[]) => eligibility.rules.filter((r) => ids.some((id) => r.id === id));
  const docs = (types: string[]) => checklist.filter((row) => types.includes(row.type));
  const evidence: Record<
    VerificationItem,
    { rules: typeof eligibility.rules; documents: typeof checklist; suggested: VerificationOutcome }
  > = {
    identity: {
      rules: byRule(["BR-001"]),
      documents: docs(["proofOfIdentity", "photo", "directorsIdentity", "companyRegistration"]),
      suggested: "PENDING",
    },
    education: {
      rules: byRule(["BR-010", "BR-011", "BR-012", "BR-013", "BR-014"]),
      documents: docs(["educationCertificate", "transcript", "foreignRecognition"]),
      suggested: "PENDING",
    },
    experience: {
      rules: byRule(["BR-020", "BR-021", "BR-022"]),
      documents: docs(["experienceEvidence", "equivalenceDecision", "previousLicence"]),
      suggested: "PENDING",
    },
    trainingExam: {
      rules: byRule(["BR-015", "BR-016"]),
      documents: docs(["trainingCertificate", "examResult", "managementTraining"]),
      suggested: "PENDING",
    },
    affiliation: {
      rules: byRule(["BR-030", "BR-031", "BR-032", "BR-033", "BR-035", "BR-036"]),
      documents: docs([
        "affiliationEvidence",
        "referralApproval",
        "independentAuthorisation",
        "appointmentLetter",
        "designationProof",
      ]),
      suggested: "PENDING",
    },
    integrity: {
      rules: byRule(["BR-060", "BR-061", "BR-062"]),
      documents: docs(["criminalRecord", "integrityDisclosure"]),
      suggested: "PENDING",
    },
  };
  for (const item of VERIFICATION_ITEMS) {
    const e = evidence[item];
    if (e.rules.length === 0 && e.documents.length === 0) e.suggested = "NA";
    else if (
      e.rules.some((r) => r.outcome === "FAIL") ||
      e.documents.some((d) => d.statuses.includes("REJECTED"))
    )
      e.suggested = "FAILED";
    else if (
      e.rules.every((r) => r.outcome === "PASS" || r.outcome === "WARN") &&
      e.documents.every((d) => d.statuses.length > 0 && d.statuses.every((s) => s === "VERIFIED"))
    )
      e.suggested = "VERIFIED";
  }
  if (
    evidence.affiliation.suggested !== "FAILED" &&
    confirmations.some((c) => c.status === "DECLINED")
  )
    evidence.affiliation.suggested = "FAILED";
  const documentation = checklist.every((row) => !row.required || row.satisfied)
    ? "COMPLETE"
    : "INCOMPLETE";
  const eligibilityOutcome: EligibilityOutcome =
    eligibility.outcome === "FAIL"
      ? "NOT_SATISFIED"
      : eligibility.outcome === "NEEDS_ASSESSMENT"
        ? "FURTHER_ASSESSMENT"
        : "SATISFIED";
  return {
    eligibility,
    checklist,
    confirmations,
    evidence,
    documentation,
    eligibilityOutcome,
  } as const;
}

/** The open (unsigned) review, created on demand with the next version number (FR-L-010). */
export async function openReview(app: Application, officer: User): Promise<Review> {
  const latest = await db.review.findFirst({
    where: { applicationId: app.id },
    orderBy: { version: "desc" },
  });
  if (latest && !latest.signedAt) return latest;
  return db.review.create({
    data: { applicationId: app.id, version: (latest?.version ?? 0) + 1, officerId: officer.id },
  });
}

export async function saveReview(input: ReviewDraft, officer: User) {
  const app = await db.application.findUnique({ where: { id: input.applicationId } });
  if (!app) throw new AppError("notFound");
  await assertReviewer(app, officer);
  if (!(REVIEWABLE as readonly string[]).includes(app.status))
    throw new AppError("invalidTransition");
  const review = await openReview(app, officer);
  const { applicationId: _ignored, ...fields } = input;
  void _ignored;
  return db.review.update({
    where: { id: review.id },
    data: {
      // The draft keeps its original author (BR-091 counts every author, security review M3).

      checks: fields.checks as object,
      documentation: fields.documentation ?? null,
      documentationOverrideReason: fields.documentationOverrideReason ?? null,
      eligibility: fields.eligibility ?? null,
      eligibilityOverrideReason: fields.eligibilityOverrideReason ?? null,
      internalComment: fields.internalComment ?? null,
      applicantComment: fields.applicantComment ?? null,
      recommendation: fields.recommendation ?? null,
      reasonCodes: fields.reasonCodes ?? [],
      reasons: fields.reasons ?? null,
      legalReference: fields.legalReference ?? null,
    },
  });
}

/**
 * Signs the review (FR-L-010): an explicit approval in the officer's two-step-verified session, BR-090 override reasons, mandatory reject
 * reasons (FR-L-009). Approve/reject recommendations go to the approver; "refer" goes to
 * further assessment (FR-L-012).
 */
export async function signReview(applicationId: string, officer: User, ctx: RequestContext) {
  const app = await db.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new AppError("notFound");
  await assertReviewer(app, officer);
  if (app.status !== "UNDER_REVIEW" && app.status !== "FURTHER_ASSESSMENT")
    throw new AppError("invalidTransition");
  const review = await db.review.findFirst({
    where: { applicationId, signedAt: null },
    orderBy: { version: "desc" },
  });
  if (!review) throw new AppError("reviewIncomplete");

  const checks = (review.checks ?? {}) as Partial<
    Record<VerificationItem, { outcome: VerificationOutcome }>
  >;
  const fieldErrors: Record<string, string> = {};
  for (const item of VERIFICATION_ITEMS) {
    const outcome = checks[item]?.outcome;
    if (!outcome || outcome === "PENDING") fieldErrors[`checks.${item}`] = "validation.required";
    if (item === "identity" && outcome === "NA")
      fieldErrors[`checks.${item}`] = "validation.identityNotNa";
  }
  if (!review.documentation) fieldErrors.documentation = "validation.required";
  if (!review.eligibility) fieldErrors.eligibility = "validation.required";
  if (!review.recommendation) fieldErrors.recommendation = "validation.required";

  const computed = await computedReview(app);
  // BR-090: overriding an auto-computed outcome needs a reason (and is flagged in reports).
  if (
    review.documentation &&
    review.documentation !== computed.documentation &&
    (review.documentationOverrideReason ?? "").length < 10
  )
    fieldErrors.documentationOverrideReason = "validation.overrideReason";
  if (
    review.eligibility &&
    review.eligibility !== computed.eligibilityOutcome &&
    (review.eligibilityOverrideReason ?? "").length < 10
  )
    fieldErrors.eligibilityOverrideReason = "validation.overrideReason";
  if (review.recommendation === "REJECT") {
    if (review.reasonCodes.length === 0) fieldErrors.reasonCodes = "validation.atLeastOne";
    if ((review.reasons ?? "").length < 10) fieldErrors.reasons = "validation.reasonTooShort";
    if (!review.legalReference) fieldErrors.legalReference = "validation.required";
  }
  if (review.recommendation === "REFER" && (review.reasons ?? "").length < 10)
    fieldErrors.reasons = "validation.reasonTooShort";
  if (Object.keys(fieldErrors).length > 0)
    throw new AppError("reviewIncomplete", "errors.reviewIncomplete", fieldErrors);

  const signedAt = new Date();
  const overridden = {
    documentation: review.documentation !== computed.documentation,
    eligibility: review.eligibility !== computed.eligibilityOutcome,
  };
  const next = review.recommendation === "REFER" ? "FURTHER_ASSESSMENT" : "PENDING_DECISION";
  await db.$transaction(async (tx) => {
    const { count } = await tx.review.updateMany({
      where: { id: review.id, signedAt: null },
      data: {
        signedAt,
        signature: {
          officerId: officer.id,
          name: officer.fullName,
          method: "CONFIRMED_MFA_SESSION",
          at: signedAt.toISOString(),
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        computed: {
          documentation: computed.documentation,
          eligibility: computed.eligibilityOutcome,
          overridden,
        },
      },
    });
    if (count === 0) throw new AppError("staleState");
    if (next !== app.status)
      await transition(tx, app, next, {
        actorId: officer.id,
        reason: next === "PENDING_DECISION" ? "reviewSigned" : "referred",
        data:
          next === "PENDING_DECISION"
            ? { slaDueAt: addWorkingDays(signedAt, SLA.decisionDays) }
            : {},
      });
  });
  await recordAudit({
    action: "review.signed",
    entityType: "Review",
    entityId: review.id,
    actorId: officer.id,
    metadata: {
      reference: app.referenceNo,
      version: review.version,
      recommendation: review.recommendation,
      overridden,
    },
    ...ctx,
  });
  if (next !== app.status) await auditTransition(app, app.status, next, officer.id, ctx);
  // The officer's part is done: what pointed them at this file leaves their inbox (UX-036).
  await db.notification.updateMany({
    where: {
      userId: officer.id,
      readAt: null,
      href: { in: [`/backoffice/review/${app.id}`, `/backoffice/decisions/${app.id}`] },
    },
    data: { readAt: new Date() },
  });
  if (next === "FURTHER_ASSESSMENT") {
    await notify(app.applicantId, {
      code: "N-050",
      messageKey: "referred",
      values: { reference: app.referenceNo },
      href: `/applications/${app.id}`,
      email: true,
    });
    // N-050 (specialist): the decision-makers see the referral and its reasons.
    await notifyUsersWithCapability(
      "decision.make",
      {
        code: "N-050",
        messageKey: "referredInternal",
        values: { reference: app.referenceNo, officer: officer.fullName },
        href: `/backoffice/review/${app.id}`,
      },
      [officer.id],
    );
  } else {
    // The signed review is the approver's work item (UX-032), and the applicant's next stage.
    await notifyUsersWithCapability(
      "decision.make",
      {
        code: "N-030",
        messageKey: "decisionReady",
        values: { reference: app.referenceNo, officer: officer.fullName },
        href: `/backoffice/decisions/${app.id}`,
        email: true,
      },
      [officer.id],
    );
    await notify(app.applicantId, {
      code: "N-011",
      messageKey: "reviewComplete",
      values: { reference: app.referenceNo },
      href: `/applications/${app.id}`,
    });
  }
}

/** FR-L-007: request information; unlock named sections and documents; ACTION_REQUIRED. */
export async function requestInformation(
  input: z.infer<typeof informationRequestSchema>,
  officer: User,
  ctx: RequestContext,
) {
  const app = await db.application.findUnique({ where: { id: input.applicationId } });
  if (!app) throw new AppError("notFound");
  await assertReviewer(app, officer);
  if (app.status !== "UNDER_REVIEW" && app.status !== "FURTHER_ASSESSMENT")
    throw new AppError("invalidTransition");
  if (input.sections.length === 0 && input.documents.length === 0 && !input.extraDocument)
    throw new AppError("validation", "errors.validation", {
      sections: "validation.unlockSomething",
    });
  const dueAt = addDaysTo(new Date(), input.dueInDays);
  const extras = input.extraDocument
    ? [...app.extraDocuments, input.extraDocument]
    : app.extraDocuments;
  await db.$transaction(async (tx) => {
    await tx.informationRequest.create({
      data: {
        applicationId: app.id,
        officerId: officer.id,
        template: input.template,
        message: input.message,
        sections: input.sections,
        documents: input.documents,
        extraDocument: input.extraDocument ?? null,
        dueAt,
      },
    });
    await transition(tx, app, "ACTION_REQUIRED", {
      actorId: officer.id,
      reason: "informationRequested",
      data: {
        unlockedSections: input.sections,
        unlockedDocuments: input.documents,
        extraDocuments: extras,
        slaDueAt: dueAt,
      },
    });
  });
  await auditTransition(
    app,
    app.status,
    "ACTION_REQUIRED",
    officer.id,
    ctx,
    "informationRequested",
  );
  await notify(app.applicantId, {
    code: "N-040",
    messageKey: "infoRequested",
    values: { reference: app.referenceNo, due: dueAt.toISOString().slice(0, 10) },
    href: `/applications/${app.id}`,
    email: true,
    sms: true,
  });
}

/** Back-office work items for the queue (FR-BO-001, FR-BO-004). */
export function slaState(
  app: Pick<Application, "slaDueAt" | "status">,
  now = new Date(),
): "ok" | "dueSoon" | "breached" | null {
  if (
    !app.slaDueAt ||
    ["LICENSE_ISSUED", "REJECTED", "WITHDRAWN", "APPROVED", "APPROVED_WITH_CONDITIONS"].includes(
      app.status,
    )
  )
    return null;
  const left = app.slaDueAt.getTime() - now.getTime();
  if (left < 0) return "breached";
  if (left < 24 * 3_600_000) return "dueSoon";
  return "ok";
}
