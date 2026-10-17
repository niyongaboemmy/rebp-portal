import "server-only";
import { createHash } from "node:crypto";
import {
  buildChecklist,
  calculateFees,
  checkSection,
  isRequiredForSubmission,
  isSatisfied,
  sectionsFor,
  SLA,
  TEXT_VERSIONS,
  type ApplicationData,
  type ChecklistItem,
  type DocumentStatus,
  type SectionKey,
} from "@rebp/contracts";
import type { Application, User } from "@/generated/prisma/client";
import { canonicalJson, recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { consumeCode, issueCode } from "../auth/verification";
import { getConfig } from "../config/config";
import { createConfirmations } from "../confirmations/confirmations";
import { db } from "../db";
import { AppError } from "../errors";
import { devCodeFor, sendEmail, sendSms } from "../notifications";
import { notify } from "../notifications/inbox";
import { addWorkingDays } from "../time";
import { autoAssign } from "../backoffice/assignment";
import {
  asData,
  auditTransition,
  ownApplication,
  sectionContext,
  transition,
} from "./applications";
import { runEligibility, storeEligibilityRun, type EligibilityRunResult } from "./facts";

/**
 * Submission (WP-2.7): the full rule run, checklist completeness and declaration (FR-WIZ-013),
 * an OTP e-signature over an immutable SHA-256 snapshot (FR-J-004/005, DATA-002), then payment
 * (BR-081), confirmations (FR-F-007) and the acknowledgment (FR-WIZ-014).
 */

export interface ChecklistRow extends ChecklistItem {
  statuses: DocumentStatus[];
  satisfied: boolean;
  required: boolean;
}

export interface Readiness {
  sections: Array<{ key: SectionKey; issues: number }>;
  checklist: ChecklistRow[];
  missingDocuments: number;
  eligibility: EligibilityRunResult;
  canSubmit: boolean;
}

export async function checklistRows(
  app: Pick<Application, "id" | "type" | "category" | "data" | "extraDocuments">,
) {
  const items = buildChecklist({ type: app.type, category: app.category, data: asData(app.data) });
  const docs = await db.document.findMany({
    where: { applicationId: app.id, removedAt: null },
    select: { type: true, status: true },
  });
  const all: ChecklistItem[] = [...items];
  if (app.extraDocuments.length > 0)
    all.push({ type: "other", requirement: "C", condition: "authority" });
  return all.map((item): ChecklistRow => {
    const statuses = docs.filter((d) => d.type === item.type).map((d) => d.status);
    return {
      ...item,
      statuses,
      satisfied: isSatisfied(statuses),
      required: isRequiredForSubmission(item),
    };
  });
}

export async function readiness(app: Application): Promise<Readiness> {
  const data = asData(app.data);
  const ctx = await sectionContext(app);
  const branchMismatch =
    app.category === "MANAGING_BROKER" && data.f?.branchId
      ? (await db.branch.findUnique({ where: { id: data.f.branchId } }))?.firmId !== data.f.firmId
      : false;
  const sections = sectionsFor(app.type, app.category).map((key) => ({
    key,
    // A Managing Broker's branch must belong to the firm they name (security review L1).
    issues:
      Object.keys(checkSection(key, data, ctx)).length + (key === "f" && branchMismatch ? 1 : 0),
  }));
  const [checklist, eligibility] = await Promise.all([
    checklistRows(app),
    runEligibility(app, data),
  ]);
  const missingDocuments = checklist.filter((row) => row.required && !row.satisfied).length;
  const canSubmit =
    sections.every((s) => s.issues === 0) &&
    missingDocuments === 0 &&
    eligibility.outcome !== "FAIL";
  return { sections, checklist, missingDocuments, eligibility, canSubmit };
}

const signable = (app: Application) => app.status === "DRAFT" || app.status === "ACTION_REQUIRED";

/** FR-J-004: sends a one-time code to the verified email or phone to sign the declaration. */
export async function requestSignature(applicationId: string, method: "EMAIL" | "SMS", user: User) {
  const app = await ownApplication(applicationId, user);
  if (!signable(app)) throw new AppError("invalidTransition");
  const ready = await readiness(app);
  if (!ready.canSubmit) throw new AppError("notReadyToSubmit");
  const target = method === "SMS" ? user.phone : user.email;
  if (!target) throw new AppError("phoneMissing");
  const code = await issueCode(
    { purpose: "SIGNATURE", target, userId: user.id, context: app.id },
    { enforceCooldown: true },
  );
  const values = { code, reference: app.referenceNo };
  if (method === "SMS") await sendSms(target, "signatureCode", values, user);
  else await sendEmail(target, "signatureCode", values, user);
  return { devCode: await devCodeFor(target, "signatureCode") };
}

/** Canonical snapshot: applicable sections only (FR-WIZ-003), plus document hashes and versions. */
async function buildSnapshot(app: Application) {
  const data = asData(app.data);
  const applicable = sectionsFor(app.type, app.category);
  const submitted: ApplicationData = {};
  for (const key of applicable)
    if (data[key] !== undefined) (submitted as Record<string, unknown>)[key] = data[key];
  const documents = await db.document.findMany({
    where: { applicationId: app.id, removedAt: null },
    orderBy: { id: "asc" },
    select: {
      id: true,
      type: true,
      currentVersion: true,
      status: true,
      versions: { orderBy: { version: "desc" }, take: 1, select: { sha256: true } },
    },
  });
  const checklist = documents.map((d) => ({
    id: d.id,
    type: d.type,
    version: d.currentVersion,
    status: d.status,
    sha256: d.versions[0]?.sha256 ?? null,
  }));
  return { data: submitted, checklist };
}

export function snapshotHash(payload: {
  reference: string;
  data: unknown;
  checklist: unknown;
  signature: unknown;
}) {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export async function signAndSubmit(
  applicationId: string,
  input: { code: string; method: "EMAIL" | "SMS"; capacity?: string },
  user: User,
  ctx: RequestContext,
) {
  const app = await ownApplication(applicationId, user);
  if (!signable(app)) throw new AppError("invalidTransition");
  const target = input.method === "SMS" ? user.phone : user.email;
  if (!target) throw new AppError("phoneMissing");
  await consumeCode({ purpose: "SIGNATURE", target, code: input.code, context: app.id });

  const ready = await readiness(app);
  if (!ready.canSubmit) throw new AppError("notReadyToSubmit");
  if (app.category === "REBF" && !input.capacity?.trim()) throw new AppError("capacityRequired");

  const { data, checklist } = await buildSnapshot(app);
  const signedAt = new Date();
  const signature = {
    signerId: user.id,
    signerName: user.fullName,
    capacity: input.capacity?.trim() || null,
    method: `OTP_${input.method}`,
    signedAt: signedAt.toISOString(),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    declarationVersion: TEXT_VERSIONS.declaration,
    privacyVersion: TEXT_VERSIONS.privacyNotice,
    codeOfConductVersion: TEXT_VERSIONS.codeOfConduct,
  };
  const hash = snapshotHash({ reference: app.referenceNo, data, checklist, signature });
  const previous = await db.applicationSnapshot.findFirst({
    where: { applicationId: app.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (previous?.version ?? 0) + 1;

  await storeEligibilityRun(app.id, "SUBMIT", ready.eligibility);

  const resubmission = app.status === "ACTION_REQUIRED";
  const fees = await getConfig("fees");
  const quote = calculateFees(fees.value, {
    category: app.category,
    type: app.type,
    late: app.lateRenewal,
  });
  const paid = await db.payment.count({
    where: { applicationId: app.id, status: { in: ["PAID", "WAIVED"] } },
  });

  await db.$transaction(async (tx) => {
    await tx.applicationSnapshot.create({
      data: {
        applicationId: app.id,
        version,
        data: JSON.parse(JSON.stringify(data)),
        checklist,
        hash,
        signature: { ...signature, snapshotHash: hash },
      },
    });
    if (!resubmission) {
      if (quote.total > 0 && paid === 0) {
        await transition(tx, app, "PENDING_PAYMENT", {
          actorId: user.id,
          reason: "signed",
          data: { signedAt },
        });
      } else {
        await tx.application.update({ where: { id: app.id }, data: { signedAt } });
      }
    }
  });
  await recordAudit({
    action: "application.signed",
    entityType: "Application",
    entityId: app.id,
    actorId: user.id,
    metadata: { reference: app.referenceNo, snapshot: version, hash, method: signature.method },
    ...ctx,
  });

  if (resubmission) {
    await afterResubmission(app, user, ctx);
  } else if (quote.total > 0 && paid === 0) {
    await auditTransition(app, "DRAFT", "PENDING_PAYMENT", user.id, ctx);
  } else {
    await proceedAfterPayment(app.id, user.id);
  }
  return { hash, version };
}

/**
 * After payment (or when no fee is due): confirmations first if any are needed (FR-F-007),
 * otherwise straight to SUBMITTED.
 */
export async function proceedAfterPayment(applicationId: string, actorId: string | null) {
  const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.status !== "PENDING_PAYMENT" && app.status !== "DRAFT") return;
  const created = await createConfirmations(app);
  if (created > 0) {
    await db.$transaction((tx) =>
      transition(tx, app, "PENDING_CONFIRMATIONS", { actorId, reason: "paid" }),
    );
    await auditTransition(app, app.status, "PENDING_CONFIRMATIONS", actorId);
    return;
  }
  await markSubmitted(app, actorId);
}

/** Final submission: timestamp (FR-PAY-006), acknowledgment (FR-WIZ-014), assignment (FR-BO-002). */
export async function markSubmitted(app: Application, actorId: string | null) {
  const submittedAt = new Date();
  await db.$transaction((tx) =>
    transition(tx, app, "SUBMITTED", {
      actorId,
      reason: "submitted",
      data: { submittedAt, slaDueAt: addWorkingDays(submittedAt, SLA.reviewStartDays) },
    }),
  );
  await auditTransition(app, app.status, "SUBMITTED", actorId);
  await notify(app.applicantId, {
    code: "N-011",
    messageKey: "submitted",
    values: { reference: app.referenceNo },
    href: `/applications/${app.id}`,
    email: true,
    sms: true,
  });
  await autoAssign(app.id);
}

/** Resubmission after an information request or a declined confirmation (FR-WF-002). */
async function afterResubmission(app: Application, user: User, ctx: RequestContext) {
  await db.informationRequest.updateMany({
    where: { applicationId: app.id, status: "OPEN" },
    data: { status: "RESPONDED", respondedAt: new Date() },
  });
  const declined = await db.confirmationRequest.count({
    where: { applicationId: app.id, status: { in: ["DECLINED", "EXPIRED"] } },
  });
  const reset = { unlockedSections: [], unlockedDocuments: [] };
  // A declined confirmation sent the application back before review: ask again (FR-F-007).
  if (declined > 0 && !app.submittedAt) {
    await db.confirmationRequest.updateMany({
      where: { applicationId: app.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    const fresh = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    await createConfirmations(fresh);
    await db.$transaction((tx) =>
      transition(tx, app, "PENDING_CONFIRMATIONS", {
        actorId: user.id,
        reason: "resubmitted",
        data: reset,
      }),
    );
    await auditTransition(app, app.status, "PENDING_CONFIRMATIONS", user.id, ctx);
    return;
  }
  await db.$transaction((tx) =>
    transition(tx, app, "UNDER_REVIEW", { actorId: user.id, reason: "resubmitted", data: reset }),
  );
  await auditTransition(app, app.status, "UNDER_REVIEW", user.id, ctx);
  if (app.assignedOfficerId)
    await notify(app.assignedOfficerId, {
      code: "N-042",
      messageKey: "applicantResponded",
      values: { reference: app.referenceNo },
      href: `/backoffice/review/${app.id}`,
    });
}

/** Re-verifies a stored snapshot (tamper test, DATA-002). */
export async function verifySnapshot(snapshotId: string) {
  const snapshot = await db.applicationSnapshot.findUniqueOrThrow({
    where: { id: snapshotId },
    include: { application: { select: { referenceNo: true } } },
  });
  const signature = { ...(snapshot.signature as Record<string, unknown>) };
  delete signature.snapshotHash;
  const hash = snapshotHash({
    reference: snapshot.application.referenceNo,
    data: snapshot.data,
    checklist: snapshot.checklist,
    signature,
  });
  return { ok: hash === snapshot.hash, hash };
}
