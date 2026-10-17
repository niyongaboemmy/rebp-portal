import "server-only";
import {
  CONFIRMATION_TTL_DAYS,
  SUPERVISED_CATEGORIES,
  type ConfirmationKind,
} from "@rebp/contracts";
import type { Application, User } from "@/generated/prisma/client";
import { asData, auditTransition, transition } from "../applications/applications";
import { findLicenceByNumber } from "../applications/facts";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { db } from "../db";
import { AppError } from "../errors";
import { notify } from "../notifications/inbox";
import { addDaysTo } from "../time";

/**
 * Supervisor and Principal Broker confirmations (WP-2.3, FR-F-007, FR-FIRM-003, SRS §4.3).
 * The application waits in PENDING_CONFIRMATIONS until every request is confirmed (or an officer
 * overrides with a reason). A decline or expiry sends it to ACTION_REQUIRED with Section F unlocked.
 */

interface Planned {
  kind: ConfirmationKind;
  addresseeId: string;
  licenceId: string | null;
  firmId: string | null;
}

/** Who must confirm this application. Duplicate addressees are merged into one request. */
export async function plannedConfirmations(app: Application): Promise<Planned[]> {
  if (app.type === "RENEWAL") return [];
  const data = asData(app.data);
  const planned: Planned[] = [];

  if (SUPERVISED_CATEGORIES.includes(app.category) && data.f?.supervisorLicenceNo) {
    const supervisor = await findLicenceByNumber(data.f.supervisorLicenceNo);
    if (supervisor?.holderId && supervisor.holderId !== app.applicantId)
      planned.push({
        kind: "SUPERVISOR",
        addresseeId: supervisor.holderId,
        licenceId: supervisor.id,
        firmId: data.f.firmId ?? null,
      });
  }

  const affiliated =
    (app.category === "RERA" && data.f?.reraMode === "FIRM") ||
    ["FSLA", "REA", "ASSOCIATE_BROKER", "MANAGING_BROKER"].includes(app.category) ||
    (app.category === "BROKER" && data.f?.practiceArrangement === "AFFILIATED");
  if (affiliated && data.f?.firmId) {
    const firm = await db.firm.findUnique({ where: { id: data.f.firmId } });
    const principal = firm?.principalLicenceId
      ? await db.licence.findUnique({ where: { id: firm.principalLicenceId } })
      : null;
    if (principal?.holderId && principal.holderId !== app.applicantId)
      planned.push({
        kind: "PRINCIPAL_BROKER",
        addresseeId: principal.holderId,
        licenceId: principal.id,
        firmId: firm!.id,
      });
  }

  // FR-G7-002/007: designating a Principal Broker of an existing firm needs the firm's own
  // confirmation (its organisation account), so nobody can take over a firm's designation.
  if (app.category === "PRINCIPAL_BROKER" && data.g?.proposedFirmRef) {
    const firm = await db.firm.findUnique({
      where: { companyRegNo: data.g.proposedFirmRef.trim() },
    });
    if (firm?.ownerId && firm.ownerId !== app.applicantId)
      planned.push({
        kind: "DESIGNATION",
        addresseeId: firm.ownerId,
        licenceId: null,
        firmId: firm.id,
      });
  }

  // FR-G8-008: the proposed Principal Broker confirms the firm's designation.
  if (app.category === "REBF" && data.g?.principalBrokerLicenceNo) {
    const principal = await findLicenceByNumber(data.g.principalBrokerLicenceNo);
    if (principal?.holderId && principal.holderId !== app.applicantId)
      planned.push({
        kind: "DESIGNATION",
        addresseeId: principal.holderId,
        licenceId: principal.id,
        firmId: null,
      });
  }

  const seen = new Set<string>();
  return planned.filter((p) => (seen.has(p.addresseeId) ? false : (seen.add(p.addresseeId), true)));
}

/** Creates the requests and notifies addressees (N-020 / N-021). Returns how many were created. */
export async function createConfirmations(app: Application): Promise<number> {
  const planned = await plannedConfirmations(app);
  if (planned.length === 0) return 0;
  const dueAt = addDaysTo(new Date(), CONFIRMATION_TTL_DAYS);
  const applicant = await db.user.findUniqueOrThrow({
    where: { id: app.applicantId },
    select: { fullName: true },
  });
  for (const p of planned) {
    const request = await db.confirmationRequest.create({
      data: {
        applicationId: app.id,
        kind: p.kind,
        addresseeId: p.addresseeId,
        licenceId: p.licenceId,
        firmId: p.firmId,
        dueAt,
      },
    });
    await notify(p.addresseeId, {
      code: p.kind === "SUPERVISOR" ? "N-020" : "N-021",
      messageKey: p.kind === "SUPERVISOR" ? "confirmSupervisor" : "confirmPrincipal",
      values: { name: applicant.fullName, reference: app.referenceNo },
      href: `/confirmations?focus=${request.id}`,
      email: true,
      sms: true,
    });
  }
  return planned.length;
}

/** All requests settled → SUBMITTED; any decline → ACTION_REQUIRED. */
async function settle(applicationId: string, actorId: string | null) {
  const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.status !== "PENDING_CONFIRMATIONS") return;
  const requests = await db.confirmationRequest.findMany({
    where: { applicationId, status: { not: "CANCELLED" } },
  });
  const failed = requests.some((r) => r.status === "DECLINED" || r.status === "EXPIRED");
  if (failed) {
    await db.$transaction(async (tx) => {
      await tx.confirmationRequest.updateMany({
        where: { applicationId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      await transition(tx, app, "ACTION_REQUIRED", {
        actorId,
        reason: "confirmationDeclined",
        data: {
          unlockedSections: app.category === "REBF" ? ["g"] : ["f"],
          unlockedDocuments: ["affiliationEvidence", "appointmentLetter", "designationProof"],
        },
      });
    });
    await auditTransition(app, app.status, "ACTION_REQUIRED", actorId, {}, "confirmationDeclined");
    return;
  }
  if (requests.length > 0 && requests.every((r) => r.status === "CONFIRMED")) {
    const { markSubmitted } = await import("../applications/submission");
    await markSubmitted(app, actorId);
  }
}

export async function respondToConfirmations(
  ids: string[],
  confirm: boolean,
  reason: string | undefined,
  user: User,
  ctx: RequestContext,
) {
  if (!confirm && (!reason || reason.trim().length < 5)) throw new AppError("reasonRequired");
  const requests = await db.confirmationRequest.findMany({
    where: { id: { in: ids }, addresseeId: user.id },
    include: {
      application: { select: { id: true, referenceNo: true, applicantId: true, status: true } },
    },
  });
  if (requests.length !== ids.length) throw new AppError("notFound");
  for (const request of requests) {
    // Conditional update: a request is answered once, even under double-submit.
    const { count } = await db.confirmationRequest.updateMany({
      where: { id: request.id, status: "PENDING" },
      data: {
        status: confirm ? "CONFIRMED" : "DECLINED",
        reason: reason ?? null,
        respondedAt: new Date(),
      },
    });
    if (count === 0) continue;
    await recordAudit({
      action: confirm ? "confirmation.confirmed" : "confirmation.declined",
      entityType: "ConfirmationRequest",
      entityId: request.id,
      actorId: user.id,
      metadata: { reference: request.application.referenceNo, kind: request.kind },
      ...ctx,
    });
    await notify(request.application.applicantId, {
      code: "N-023",
      messageKey: confirm ? "confirmationConfirmed" : "confirmationDeclined",
      values: { name: user.fullName, reference: request.application.referenceNo },
      href: `/applications/${request.application.id}`,
      email: true,
      sms: !confirm,
    });
    await settle(request.applicationId, user.id);
  }
}

/** Officer override with a mandatory reason (FR-F-007, App. D "Override (reason)"). */
export async function overrideConfirmation(
  id: string,
  reason: string,
  officer: User,
  ctx: RequestContext,
) {
  const request = await db.confirmationRequest.findUnique({
    where: { id },
    include: { application: { select: { referenceNo: true } } },
  });
  if (!request) throw new AppError("notFound");
  // M1: no override on an application the officer has a conflict with (BR-093), and only while
  // the application is actually waiting for confirmations.
  const app = await db.application.findUniqueOrThrow({
    where: { id: request.applicationId },
    select: { status: true },
  });
  if (app.status !== "PENDING_CONFIRMATIONS") throw new AppError("invalidTransition");
  const { conflictsFor } = await import("../backoffice/assignment");
  if ((await conflictsFor(request.applicationId, officer.id)).length > 0)
    throw new AppError("conflictOfInterest");
  const { count } = await db.confirmationRequest.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: "CONFIRMED",
      overriddenById: officer.id,
      overrideReason: reason,
      respondedAt: new Date(),
    },
  });
  if (count === 0) throw new AppError("staleState");
  await recordAudit({
    action: "confirmation.overridden",
    entityType: "ConfirmationRequest",
    entityId: id,
    actorId: officer.id,
    metadata: { reference: request.application.referenceNo, kind: request.kind, reason },
    ...ctx,
  });
  await settle(request.applicationId, officer.id);
}

/** Requests still waiting for this person (the nav badge, FR-PORTAL-001). */
export async function pendingConfirmationCount(userId: string): Promise<number> {
  return db.confirmationRequest.count({ where: { addresseeId: userId, status: "PENDING" } });
}

/** Inbox for supervisors and Principal Brokers (FR-FIRM-003). */
export async function confirmationInbox(userId: string) {
  return db.confirmationRequest.findMany({
    where: { addresseeId: userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      application: {
        select: {
          id: true,
          referenceNo: true,
          category: true,
          type: true,
          data: true,
          applicant: { select: { fullName: true } },
        },
      },
    },
  });
}

/** Scheduled: expire overdue requests (FR-WF-006) and remind on days 3, 7 and 12 (N-022). */
export async function processConfirmationTimers(now = new Date()) {
  const pending = await db.confirmationRequest.findMany({
    where: { status: "PENDING" },
    include: { application: { select: { referenceNo: true, applicantId: true } } },
  });
  let expired = 0;
  let reminded = 0;
  for (const request of pending) {
    if (request.dueAt <= now) {
      const { count } = await db.confirmationRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: { status: "EXPIRED", respondedAt: now },
      });
      if (count > 0) {
        expired++;
        await notify(request.application.applicantId, {
          code: "N-022",
          messageKey: "confirmationExpired",
          values: { reference: request.application.referenceNo },
          href: `/applications/${request.applicationId}`,
          email: true,
        });
        await settle(request.applicationId, null);
      }
      continue;
    }
    const ageDays = Math.floor((now.getTime() - request.createdAt.getTime()) / 86_400_000);
    const due = [3, 7, 12].filter((d) => ageDays >= d).length;
    if (due > request.reminders) {
      await db.confirmationRequest.update({ where: { id: request.id }, data: { reminders: due } });
      await notify(request.addresseeId, {
        code: "N-022",
        messageKey: "confirmationReminder",
        values: { reference: request.application.referenceNo },
        href: `/confirmations?focus=${request.id}`,
        email: true,
        sms: true,
      });
      reminded++;
    }
  }
  return { expired, reminded };
}

/** FR-PORTAL-004 "Supervisor has not confirmed — Send reminder": the applicant nudges an addressee. */
export async function remindAddressee(confirmationId: string, user: User) {
  const request = await db.confirmationRequest.findUnique({
    where: { id: confirmationId },
    include: { application: { select: { applicantId: true, referenceNo: true } } },
  });
  if (!request || request.application.applicantId !== user.id || request.status !== "PENDING")
    throw new AppError("notFound");
  const key = `nudge:${request.id}:${new Date().toISOString().slice(0, 10)}`;
  const already = await db.reminderLog.findUnique({ where: { key } });
  if (already) throw new AppError("reminderAlreadySent");
  await db.reminderLog.create({ data: { key } });
  await notify(request.addresseeId, {
    code: "N-022",
    messageKey: "confirmationReminder",
    values: { reference: request.application.referenceNo },
    href: `/confirmations?focus=${request.id}`,
    email: true,
  });
}
