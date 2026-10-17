import "server-only";
import {
  evaluateEligibility,
  renewalTiming,
  type ApplicationData,
  type EligibilityFacts,
  type EligibilityResult,
  type HeldLicenceSummary,
  type LicenceFact,
} from "@rebp/contracts";
import type { Application, Licence } from "@/generated/prisma/client";
import { getConfig } from "../config/config";
import { db } from "../db";
import { dayOf, todayKigali } from "../time";

/**
 * Builds the register facts the eligibility engine needs (FR-ELG-001, FR-E-007, BR-030…033) and
 * runs it. The engine itself is pure (in @rebp/contracts) and shared with the wizard.
 */
type LicenceWithEvents = Licence & {
  events?: Array<{ toStatus: string; startsOn: Date | null; endsOn: Date | null; at: Date }>;
};

export function toFact(licence: LicenceWithEvents, applicantId?: string): LicenceFact {
  const suspensions = (licence.events ?? [])
    .filter((e) => e.toStatus === "SUSPENDED")
    .map((e) => ({ from: dayOf(e.startsOn ?? e.at), to: e.endsOn ? dayOf(e.endsOn) : null }));
  return {
    licenceNo: licence.licenceNo,
    category: licence.category,
    status: licence.status,
    issuedAt: dayOf(licence.issuedAt),
    expiresAt: dayOf(licence.expiresAt),
    holderIsApplicant: applicantId ? licence.holderId === applicantId : undefined,
    suspensions,
  };
}

export async function findLicenceByNumber(licenceNo: string | undefined | null) {
  if (!licenceNo) return null;
  return db.licence.findFirst({
    where: { licenceNo: { equals: licenceNo.trim(), mode: "insensitive" } },
    include: { events: { select: { toStatus: true, startsOn: true, endsOn: true, at: true } } },
  });
}

/** Licences held by a user, for the type × category matrix (FR-DOM-001). */
export async function heldLicenceSummaries(userId: string): Promise<HeldLicenceSummary[]> {
  const [licences, thresholds] = await Promise.all([
    db.licence.findMany({ where: { holderId: userId }, orderBy: { issuedAt: "desc" } }),
    getConfig("thresholds"),
  ]);
  const today = todayKigali();
  return licences.map((l) => ({
    id: l.id,
    category: l.category,
    status: l.status,
    expiresAt: l.expiresAt,
    renewable: ["open", "late"].includes(
      renewalTiming(l.status, dayOf(l.expiresAt), today, thresholds.value),
    ),
  }));
}

export async function eligibilityFacts(
  app: Pick<Application, "id" | "applicantId" | "category" | "relatedLicenceId">,
  data: ApplicationData,
): Promise<EligibilityFacts> {
  const today = todayKigali();
  const held = await db.licence.findMany({
    where: { holderId: app.applicantId },
    include: { events: { select: { toStatus: true, startsOn: true, endsOn: true, at: true } } },
  });
  const facts: EligibilityFacts = { today, held: held.map((l) => toFact(l, app.applicantId)) };

  if (data.f?.supervisorLicenceNo) {
    const supervisor = await findLicenceByNumber(data.f.supervisorLicenceNo);
    facts.supervisor = supervisor ? toFact(supervisor, app.applicantId) : null;
  }
  const firmId = data.f?.firmId;
  if (firmId || data.f?.firmName) {
    const firm = firmId ? await db.firm.findUnique({ where: { id: firmId } }) : null;
    facts.firm = firm
      ? { found: true, status: firm.status, hasPrincipal: Boolean(firm.principalLicenceId) }
      : null;
  }
  if (app.category === "REBF" && data.g?.principalBrokerLicenceNo) {
    const principal = await findLicenceByNumber(data.g.principalBrokerLicenceNo);
    facts.principal = principal ? toFact(principal) : null;
    if (principal?.holderId && principal.category !== "PRINCIPAL_BROKER") {
      // FR-FIRM-011: a linked Principal Broker designation from the same Broker is pending.
      const pending = await db.application.count({
        where: {
          applicantId: principal.holderId,
          category: "PRINCIPAL_BROKER",
          status: { notIn: ["DRAFT", "WITHDRAWN", "REJECTED", "EXPIRED_DRAFT", "LICENSE_ISSUED"] },
        },
      });
      facts.principalPending = pending > 0;
    }
  }
  if (app.category === "MANAGING_BROKER" && data.f?.branchId) {
    const branch = await db.branch.findUnique({ where: { id: data.f.branchId } });
    if (branch) {
      const current = branch.managingLicenceId
        ? await db.licence.findUnique({ where: { id: branch.managingLicenceId } })
        : null;
      facts.branchHasManagingBroker = Boolean(
        current && current.status === "ACTIVE" && current.holderId !== app.applicantId,
      );
    }
  }
  if (app.relatedLicenceId) {
    const related = await db.licence.findUnique({
      where: { id: app.relatedLicenceId },
      include: { events: { select: { toStatus: true, startsOn: true, endsOn: true, at: true } } },
    });
    facts.relatedLicence = related ? toFact(related, app.applicantId) : null;
  }
  return facts;
}

export interface EligibilityRunResult extends EligibilityResult {
  thresholdsVersion: number;
}

/** Runs the engine against current data (FR-ELG-003). Callers decide whether to persist. */
export async function runEligibility(
  app: Pick<Application, "id" | "applicantId" | "category" | "type" | "relatedLicenceId">,
  data: ApplicationData,
): Promise<EligibilityRunResult> {
  const [facts, thresholds] = await Promise.all([
    eligibilityFacts(app, data),
    getConfig("thresholds"),
  ]);
  const result = evaluateEligibility({
    type: app.type,
    category: app.category,
    data,
    facts,
    thresholds: thresholds.value,
  });
  return { ...result, thresholdsVersion: thresholds.version };
}

export async function storeEligibilityRun(
  applicationId: string,
  context: "SUBMIT" | "REVIEW",
  result: EligibilityRunResult,
) {
  await db.eligibilityRun.create({
    data: {
      applicationId,
      context,
      outcome: result.outcome,
      results: JSON.parse(
        JSON.stringify({ rules: result.rules, experience: result.experience ?? null }),
      ),
      thresholdsVersion: result.thresholdsVersion,
    },
  });
  await db.application.update({
    where: { id: applicationId },
    data: { eligibilityOutcome: result.outcome },
  });
}
