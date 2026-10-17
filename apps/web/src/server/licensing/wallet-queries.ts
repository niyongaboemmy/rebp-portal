import "server-only";
import type { ApplicationStatus } from "@rebp/contracts";
import { db } from "../db";
import { divisionNames } from "./public-queries";

/**
 * Read models for the applicant's licence wallet and dashboard (FR-PORTAL-001…004, FR-N-002/008,
 * FR-REN-001). Every query is scoped to the signed-in holder.
 */

const firmName = { select: { legalName: true, tradingName: true } } as const;

/** The holder's licences, newest first (FR-PORTAL-003). */
export async function walletLicences(userId: string) {
  return db.licence.findMany({
    where: { holderId: userId },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
    include: { firm: firmName, affiliatedFirm: firmName, branch: { select: { name: true } } },
  });
}

/** One licence with everything the detail page shows, or null when it isn't the holder's. */
export async function walletLicence(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const licence = await db.licence.findUnique({
    where: { id },
    include: {
      registrant: { select: { registrationNo: true } },
      firm: firmName,
      affiliatedFirm: firmName,
      branch: { select: { name: true, district: true } },
      application: { select: { id: true, referenceNo: true } },
      events: {
        orderBy: { at: "desc" },
        take: 30,
        select: { id: true, action: true, toStatus: true, at: true, startsOn: true, endsOn: true },
      },
    },
  });
  if (!licence || licence.holderId !== userId) return null;
  const [supervisor, names, replacement] = await Promise.all([
    licence.supervisorLicenceId
      ? db.licence.findUnique({
          where: { id: licence.supervisorLicenceId },
          select: { displayName: true, licenceNo: true, status: true },
        })
      : null,
    divisionNames([
      ...licence.scope,
      ...(licence.branch?.district ? [licence.branch.district] : []),
    ]),
    licence.supersededById
      ? db.licence.findUnique({
          where: { id: licence.supersededById },
          select: { id: true, licenceNo: true },
        })
      : null,
  ]);
  return { licence, supervisor, names, replacement };
}

/** Statuses in which an application is still moving (dashboard "in progress"). */
export const IN_PROGRESS_STATUSES: readonly ApplicationStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PENDING_CONFIRMATIONS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_DECISION",
  "DEFERRED",
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
];

/**
 * Who the applicant's submitted applications are waiting on (FR-PORTAL-004), and how many
 * confirmation requests are waiting for the user's own answer.
 */
export async function dashboardWaiting(userId: string) {
  const [pending, inbox] = await Promise.all([
    db.confirmationRequest.findMany({
      where: { status: "PENDING", application: { applicantId: userId } },
      orderBy: { dueAt: "asc" },
      take: 5,
      select: {
        id: true,
        kind: true,
        dueAt: true,
        applicationId: true,
        addressee: { select: { fullName: true } },
      },
    }),
    db.confirmationRequest.count({ where: { addresseeId: userId, status: "PENDING" } }),
  ]);
  return { pending, inbox };
}
