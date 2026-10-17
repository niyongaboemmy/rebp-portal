import "server-only";
import { db } from "../db";

/**
 * Read models for the regulator work screens (WP-3.2, WP-3.3/3.5, WP-3.6): queue KPIs, the
 * Section L console, the decisions list and the Section M console. Reads only — every mutation
 * goes through the domain modules (review.ts, assignment.ts, decision.ts).
 */

const WORKING = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_DECISION",
  "PENDING_CONFIRMATIONS",
] as const;

/** FR-BO-001 / FR-BO-004: unassigned work and SLA breaches across the working statuses. */
export async function queueKpis() {
  const [unassigned, breached] = await Promise.all([
    db.application.count({ where: { status: { in: [...WORKING] }, assignedOfficerId: null } }),
    db.application.count({ where: { status: { in: [...WORKING] }, slaDueAt: { lt: new Date() } } }),
  ]);
  return { unassigned, breached };
}

/** Everything the Section L console shows (FR-L-001…011, FR-BO-005). */
export async function reviewConsole(applicationId: string) {
  return db.application.findUnique({
    where: { id: applicationId },
    include: {
      applicant: { select: { id: true, fullName: true, email: true } },
      assignedOfficer: { select: { id: true, fullName: true } },
      documents: {
        where: { removedAt: null },
        orderBy: [{ type: "asc" }, { createdAt: "asc" }],
        include: {
          versions: {
            orderBy: { version: "desc" },
            select: {
              version: true,
              fileName: true,
              mimeType: true,
              size: true,
              scanStatus: true,
              createdAt: true,
            },
          },
        },
      },
      events: { orderBy: { at: "asc" } },
      confirmations: {
        orderBy: { createdAt: "asc" },
        include: { addressee: { select: { fullName: true } } },
      },
      infoRequests: { orderBy: { createdAt: "desc" } },
      reviews: {
        orderBy: { version: "desc" },
        include: { officer: { select: { id: true, fullName: true } } },
      },
      snapshots: {
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true, hash: true, createdAt: true },
      },
      decisions: {
        orderBy: { signedAt: "desc" },
        include: { approver: { select: { fullName: true } } },
      },
      licences: {
        orderBy: { createdAt: "desc" },
        select: { id: true, licenceNo: true, status: true },
      },
    },
  });
}
export type ReviewConsole = NonNullable<Awaited<ReturnType<typeof reviewConsole>>>;

/** Display names for actor ids on timelines (officers, applicants, system = null). */
export async function userNames(
  ids: ReadonlyArray<string | null | undefined>,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return {};
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true },
  });
  return Object.fromEntries(users.map((u) => [u.id, u.fullName]));
}

/** Names for administrative-division codes (FR-B-009), e.g. addresses and territories. */
export async function divisionNames(
  codes: ReadonlyArray<string | null | undefined>,
): Promise<Record<string, string>> {
  const unique = [...new Set(codes.filter((code): code is string => Boolean(code)))];
  if (unique.length === 0) return {};
  const rows = await db.adminDivision.findMany({
    where: { code: { in: unique } },
    select: { code: true, name: true },
  });
  return Object.fromEntries(rows.map((r) => [r.code, r.name]));
}

/** M.8 geographic scope options: districts (level 2). */
export async function districts() {
  return db.adminDivision.findMany({
    where: { level: 2 },
    orderBy: { name: "asc" },
    select: { code: true, name: true, parentCode: true },
  });
}

/** FR-M-001: applications waiting for a Section M decision, oldest signature first. */
export async function pendingDecisions() {
  const apps = await db.application.findMany({
    where: { status: "PENDING_DECISION" },
    orderBy: [{ slaDueAt: { sort: "asc", nulls: "last" } }, { updatedAt: "asc" }],
    include: {
      applicant: { select: { fullName: true } },
      assignedOfficer: { select: { fullName: true } },
      reviews: {
        where: { signedAt: { not: null } },
        orderBy: { version: "desc" },
        take: 1,
        select: { recommendation: true, signedAt: true, officer: { select: { fullName: true } } },
      },
    },
  });
  return apps.map(({ reviews, ...app }) => ({ ...app, review: reviews[0] ?? null }));
}

/** The Section M console: application, latest signed review, decisions and issued licences. */
export async function decisionConsole(applicationId: string) {
  return db.application.findUnique({
    where: { id: applicationId },
    include: {
      applicant: { select: { fullName: true, email: true } },
      assignedOfficer: { select: { fullName: true } },
      reviews: {
        where: { signedAt: { not: null } },
        orderBy: { version: "desc" },
        include: { officer: { select: { fullName: true } } },
      },
      decisions: {
        orderBy: { signedAt: "desc" },
        include: { approver: { select: { fullName: true } } },
      },
      licences: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          licenceNo: true,
          status: true,
          issuedAt: true,
          expiresAt: true,
          decisionId: true,
        },
      },
    },
  });
}
export type DecisionConsole = NonNullable<Awaited<ReturnType<typeof decisionConsole>>>;
