import "server-only";
import {
  addYears,
  formatLicenceNo,
  formatRegistrationNo,
  type Category,
  type DecisionCondition,
  type LicenseStatus,
} from "@rebp/contracts";
import type { Application, Decision, Licence, Prisma, Role } from "@/generated/prisma/client";
import { asData, transition } from "../applications/applications";
import { findLicenceByNumber } from "../applications/facts";
import { nextSequence } from "../applications/numbers";
import { recordAudit } from "../audit/audit";
import { randomToken } from "../auth/crypto";
import { getConfig } from "../config/config";
import { db } from "../db";
import { AppError } from "../errors";
import { notify } from "../notifications/inbox";
import { dateOf, dayOf, todayKigali } from "../time";
import { projectLicence } from "./register";

/**
 * Section N licensing (WP-3.7, FR-N-001…009/012, BR-092). Issuance runs after a signed approval,
 * as one transaction: registrant, licence, affiliation, firm records, role grants, status history,
 * the register projection and the application's LICENSE_ISSUED state. It is idempotent: a retry
 * after a failure returns the licence already issued (FR-N-009).
 */
type Tx = Prisma.TransactionClient;

const SUPERVISING_CATEGORIES: readonly Category[] = [
  "REA",
  "BROKER",
  "ASSOCIATE_BROKER",
  "MANAGING_BROKER",
  "PRINCIPAL_BROKER",
];

async function ensureRegistrant(
  tx: Tx,
  app: Application,
  displayName: string,
  firmId: string | null,
) {
  if (firmId) {
    const existing = await tx.registrant.findUnique({ where: { firmId } });
    if (existing) return existing;
    const seq = await nextSequence("registrant_firm_seq", tx);
    return tx.registrant.create({
      data: {
        kind: "FIRM",
        registrationNo: formatRegistrationNo("FIRM", seq),
        firmId,
        displayName,
      },
    });
  }
  const existing = await tx.registrant.findUnique({ where: { userId: app.applicantId } });
  if (existing) return existing;
  const seq = await nextSequence("registrant_person_seq", tx);
  return tx.registrant.create({
    data: {
      kind: "PERSON",
      registrationNo: formatRegistrationNo("PERSON", seq),
      userId: app.applicantId,
      displayName,
    },
  });
}

function practiceArrangement(app: Application): string {
  const f = asData(app.data).f;
  switch (app.category) {
    case "RERA":
      return f?.reraMode === "REFERRAL" ? "REFERRAL_ONLY" : "AFFILIATED";
    case "BROKER":
      return f?.practiceArrangement ?? "AFFILIATED";
    case "PRINCIPAL_BROKER":
      return "FIRM_PRINCIPAL";
    case "REBF":
      return "FIRM";
    default:
      return "AFFILIATED";
  }
}

/** REBF: the firm record, its branches and its Principal Broker link (FR-G8-001…009, BR-032). */
async function upsertFirm(tx: Tx, app: Application) {
  const g = asData(app.data).g ?? {};
  const principal = await findLicenceByNumber(g.principalBrokerLicenceNo);
  if (!principal || principal.category !== "PRINCIPAL_BROKER" || principal.status !== "ACTIVE")
    throw new AppError("principalNotApproved");
  const office = g.registeredOffice ?? {};
  const data = {
    legalName: g.legalName ?? "",
    tradingName: g.tradingName || null,
    address: office as object,
    district: office.district ?? null,
    phone: g.phone ?? null,
    email: g.email ?? null,
    ownerId: app.applicantId,
    principalLicenceId: principal.id,
    status: "ACTIVE",
  };
  const firm = await tx.firm.upsert({
    where: { companyRegNo: g.companyRegNo ?? "" },
    update: data,
    create: { ...data, companyRegNo: g.companyRegNo ?? "" },
  });
  const existing = await tx.branch.count({ where: { firmId: firm.id } });
  if (existing === 0) {
    for (const branch of g.branches ?? []) {
      const manager = await findLicenceByNumber(branch.managingBrokerLicenceNo);
      await tx.branch.create({
        data: {
          firmId: firm.id,
          name: branch.name ?? "",
          address: (branch.address ?? {}) as object,
          district: branch.address?.district ?? null,
          phone: branch.phone ?? null,
          managingLicenceId:
            manager?.category === "MANAGING_BROKER" && manager.status === "ACTIVE"
              ? manager.id
              : null,
        },
      });
    }
  }
  await tx.licence.update({ where: { id: principal.id }, data: { affiliatedFirmId: firm.id } });
  return firm;
}

async function addEvent(
  tx: Tx,
  licence: Pick<Licence, "id">,
  from: LicenseStatus | null,
  to: LicenseStatus,
  action: string,
  extra: {
    actorId?: string | null;
    reason?: string;
    reference?: string;
    startsOn?: Date;
    endsOn?: Date | null;
  } = {},
) {
  await tx.licenceEvent.create({
    data: {
      licenceId: licence.id,
      fromStatus: from,
      toStatus: to,
      action,
      actorId: extra.actorId ?? null,
      reason: extra.reason ?? null,
      reference: extra.reference ?? null,
      startsOn: extra.startsOn ?? null,
      endsOn: extra.endsOn ?? null,
    },
  });
}

async function grantRoles(tx: Tx, userId: string, roles: Role[]) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { roles: true } });
  const next = Array.from(new Set([...user.roles, ...roles]));
  if (next.length !== user.roles.length)
    await tx.user.update({ where: { id: userId }, data: { roles: next } });
}

/** Issues (or renews) the licence for an approved application. Idempotent. */
export async function issueLicence(
  applicationId: string,
  actorId: string | null,
): Promise<Licence> {
  const existing = await db.licence.findFirst({ where: { applicationId } });
  const app0 = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app0.status === "LICENSE_ISSUED" && existing) return existing;
  if (app0.type === "RENEWAL" && app0.status === "LICENSE_ISSUED" && app0.relatedLicenceId)
    return db.licence.findUniqueOrThrow({ where: { id: app0.relatedLicenceId } });

  const decision = await db.decision.findFirst({
    where: { applicationId, decision: { in: ["APPROVED", "APPROVED_WITH_CONDITIONS"] } },
    orderBy: { signedAt: "desc" },
  });
  // BR-092: only after a signed approval.
  if (!decision || !["APPROVED", "APPROVED_WITH_CONDITIONS"].includes(app0.status))
    throw new AppError("noApproval");
  const thresholds = (await getConfig("thresholds")).value;
  const today = todayKigali();

  const licence = await db.$transaction(
    async (tx) => {
      const app = await tx.application.findUniqueOrThrow({ where: { id: applicationId } });
      if (app.status === "LICENSE_ISSUED") {
        const done = await tx.licence.findFirst({ where: { applicationId } });
        if (done) return done;
      }
      const data = asData(app.data);
      const applicant = await tx.user.findUniqueOrThrow({ where: { id: app.applicantId } });
      const conditions = (decision.conditions as unknown as DecisionCondition[]) ?? [];

      // Renewal: the same licence continues with a new term (FR-REN-002).
      if (app.type === "RENEWAL" && app.relatedLicenceId) {
        const current = await tx.licence.findUniqueOrThrow({ where: { id: app.relatedLicenceId } });
        const base = dayOf(current.expiresAt) > today ? dayOf(current.expiresAt) : today;
        const renewed = await tx.licence.update({
          where: { id: current.id },
          data: {
            status: "ACTIVE",
            expiresAt: dateOf(addYears(base, thresholds.licenceValidityYears)),
            certificateVersion: { increment: 1 },
            qrToken: randomToken(18),
            conditions: conditions.length
              ? (conditions as object[])
              : (current.conditions as object),
            decisionId: decision.id,
            flags: current.flags.filter((f) => f !== "RENEWAL_PENDING"),
          },
        });
        await addEvent(tx, renewed, current.status, "ACTIVE", "RENEWED", {
          actorId,
          reference: app.referenceNo,
        });
        await addEvent(tx, renewed, "ACTIVE", "ACTIVE", "CERTIFICATE_REISSUED", {
          actorId,
          reference: current.qrToken,
        });
        await projectLicence(renewed.id, tx);
        await transition(tx, app, "LICENSE_ISSUED", { actorId, reason: "licenceRenewed" });
        return renewed;
      }

      const firm = app.category === "REBF" ? await upsertFirm(tx, app) : null;
      const displayName =
        app.category === "REBF"
          ? data.g?.tradingName || data.g?.legalName || applicant.fullName
          : [data.b?.givenNames, data.b?.surname].filter(Boolean).join(" ") || applicant.fullName;
      const registrant = await ensureRegistrant(tx, app, displayName, firm?.id ?? null);
      const seq = await nextSequence("licence_seq", tx);
      const supervisor = await findLicenceByNumber(data.f?.supervisorLicenceNo);
      const photo = await tx.document.findFirst({
        where: {
          applicationId: app.id,
          type: "photo",
          removedAt: null,
          status: { in: ["CLEAN", "VERIFIED"] },
        },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });
      const scope = decision.geoScope.length ? decision.geoScope : (data.g?.territory ?? []);
      const affiliatedFirmId =
        app.category === "PRINCIPAL_BROKER"
          ? ((await tx.firm.findUnique({ where: { companyRegNo: data.g?.proposedFirmRef ?? "" } }))
              ?.id ?? null)
          : (data.f?.firmId ?? null);

      const created = await tx.licence.create({
        data: {
          licenceNo: formatLicenceNo(app.category, Number(today.slice(0, 4)), seq),
          registrantId: registrant.id,
          holderId: app.applicantId,
          firmId: firm?.id ?? null,
          category: decision.approvedCategory ?? app.category,
          displayName,
          issuedAt: dateOf(today),
          expiresAt: dateOf(addYears(today, thresholds.licenceValidityYears)),
          applicationId: app.id,
          decisionId: decision.id,
          scope,
          practiceArrangement: practiceArrangement(app),
          conditions: conditions as object[],
          supervisorLicenceId: supervisor?.id ?? null,
          affiliatedFirmId,
          branchId: app.category === "MANAGING_BROKER" ? (data.f?.branchId ?? null) : null,
          qrToken: randomToken(18),
          photoVersionId: photo?.versions[0]?.id ?? null,
        },
      });
      await addEvent(tx, created, null, "ACTIVE", "ISSUED", {
        actorId,
        reference: app.referenceNo,
      });

      if (affiliatedFirmId && app.category !== "PRINCIPAL_BROKER") {
        await tx.affiliation.create({
          data: {
            licenceId: created.id,
            firmId: affiliatedFirmId,
            supervisorLicenceId: supervisor?.id ?? null,
            branchId: created.branchId,
            startsOn: data.f?.affiliationStart ? dateOf(data.f.affiliationStart) : dateOf(today),
          },
        });
      }
      if (
        app.category === "MANAGING_BROKER" &&
        data.f?.branchId &&
        (await tx.branch.findUnique({ where: { id: data.f.branchId } }))?.firmId === data.f.firmId
      )
        await tx.branch.update({
          where: { id: data.f.branchId },
          data: { managingLicenceId: created.id },
        });
      if (app.category === "PRINCIPAL_BROKER" && affiliatedFirmId) {
        // BR-032 / FR-G7-007: one active Principal Broker; the previous designation is superseded.
        const target = await tx.firm.findUniqueOrThrow({ where: { id: affiliatedFirmId } });
        if (target.principalLicenceId && target.principalLicenceId !== created.id) {
          const previous = await tx.licence.update({
            where: { id: target.principalLicenceId },
            data: { status: "SUPERSEDED", supersededById: created.id },
          });
          await addEvent(tx, previous, "ACTIVE", "SUPERSEDED", "SUPERSEDED", {
            actorId,
            reference: created.licenceNo,
          });
          await projectLicence(previous.id, tx);
        }
        await tx.firm.update({
          where: { id: affiliatedFirmId },
          data: { principalLicenceId: created.id },
        });
      }
      // FR-WF-012: an upgrade supersedes the lower licence; its history stays visible.
      if (app.type === "UPGRADE" && app.relatedLicenceId) {
        const lower = await tx.licence.update({
          where: { id: app.relatedLicenceId },
          data: { status: "SUPERSEDED", supersededById: created.id },
        });
        await addEvent(tx, lower, "ACTIVE", "SUPERSEDED", "SUPERSEDED", {
          actorId,
          reference: created.licenceNo,
        });
        await projectLicence(lower.id, tx);
      }

      const roles: Role[] = [];
      if (SUPERVISING_CATEGORIES.includes(created.category)) roles.push("SUPERVISOR");
      if (created.category === "PRINCIPAL_BROKER") roles.push("PRINCIPAL_BROKER");
      if (created.category === "REBF") roles.push("FIRM_ADMIN");
      if (roles.length) await grantRoles(tx, app.applicantId, roles);

      await projectLicence(created.id, tx);
      await transition(tx, app, "LICENSE_ISSUED", { actorId, reason: "licenceIssued" });
      return created;
    },
    { timeout: 20_000 },
  );

  await recordAudit({
    action: app0.type === "RENEWAL" ? "licence.renewed" : "licence.issued",
    entityType: "Licence",
    entityId: licence.id,
    actorId,
    metadata: {
      reference: app0.referenceNo,
      licenceNo: licence.licenceNo,
      category: licence.category,
    },
  });
  return licence;
}

/** FR-N-012: reissue rotates the QR token; the old QR then shows "superseded, see current". */
export async function reissueCertificate(licenceId: string, actorId: string, reason: string) {
  const licence = await db.licence.findUniqueOrThrow({ where: { id: licenceId } });
  await db.$transaction(async (tx) => {
    await tx.licence.update({
      where: { id: licenceId },
      data: { qrToken: randomToken(18), certificateVersion: { increment: 1 } },
    });
    await addEvent(tx, licence, licence.status, licence.status, "CERTIFICATE_REISSUED", {
      actorId,
      reason,
      reference: licence.qrToken,
    });
    await projectLicence(licenceId, tx);
  });
  await recordAudit({
    action: "licence.certificate_reissued",
    entityType: "Licence",
    entityId: licenceId,
    actorId,
    metadata: { licenceNo: licence.licenceNo },
  });
}

/** Applicant-facing notices after a decision (N-060/N-061/N-062) — also tells the firm's PB. */
export async function notifyDecision(
  app: Application,
  decision: Decision,
  licence: Licence | null,
) {
  const key =
    decision.decision === "APPROVED"
      ? "approved"
      : decision.decision === "APPROVED_WITH_CONDITIONS"
        ? "approvedConditions"
        : decision.decision === "DEFERRED"
          ? "deferred"
          : "rejected";
  const code = key === "deferred" ? "N-061" : key === "rejected" ? "N-062" : "N-060";
  await notify(app.applicantId, {
    code,
    messageKey: key,
    values: { reference: app.referenceNo, licence: licence?.licenceNo ?? "" },
    href: licence ? `/licenses/${licence.id}` : `/applications/${app.id}`,
    email: true,
    sms: true,
  });
  const firmId = asData(app.data).f?.firmId;
  if (licence && firmId) {
    const firm = await db.firm.findUnique({ where: { id: firmId } });
    const principal = firm?.principalLicenceId
      ? await db.licence.findUnique({ where: { id: firm.principalLicenceId } })
      : null;
    if (principal?.holderId && principal.holderId !== app.applicantId)
      await notify(principal.holderId, {
        code: "N-060",
        messageKey: "affiliateLicensed",
        values: { name: licence.displayName, licence: licence.licenceNo },
        href: "/firm",
      });
  }
}

/** FR-N-009: retry issuance for approvals whose licence step failed. */
export async function retryPendingIssuance() {
  const stuck = await db.application.findMany({
    where: {
      status: { in: ["APPROVED", "APPROVED_WITH_CONDITIONS"] },
      decidedAt: { lt: new Date(Date.now() - 60_000) },
    },
    select: { id: true },
  });
  let issued = 0;
  for (const app of stuck) {
    try {
      await issueLicence(app.id, null);
      issued++;
    } catch (error) {
      console.error("[licensing] retry failed", {
        applicationId: app.id,
        error: (error as Error).message,
      });
    }
  }
  return { retried: stuck.length, issued };
}
