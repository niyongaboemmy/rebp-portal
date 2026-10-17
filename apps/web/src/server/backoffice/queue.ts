import "server-only";
import { QUEUE_UNASSIGNED, type QueueQuery } from "@rebp/contracts";
import type { Prisma, User } from "@/generated/prisma/client";
import { db } from "../db";

/**
 * Work queues (WP-3.1/3.2, FR-BO-001, FR-BO-004): filters by status, category, type, assigned
 * officer and reference or name; views for "mine", "unassigned", "SLA risk" and "awaiting
 * decision"; sorts by deadline, submission or time in state. Filters live in the URL, so a view
 * can be saved as a bookmark and shared.
 */
export const QUEUE_PAGE_SIZE = 25;

const WORKING = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_DECISION",
  "PENDING_CONFIRMATIONS",
] as const;

/** "Oldest in state" needs the latest event per file; queues are small enough to sort in memory. */
const STALE_SORT_LIMIT = 5_000;

export async function queue(query: QueueQuery, officer: Pick<User, "id">) {
  const view = query.view ?? "mine";
  const where: Prisma.ApplicationWhereInput = {
    status: query.status ?? { in: [...WORKING] },
    ...(query.category ? { category: query.category } : {}),
    ...(query.type ? { type: query.type } : {}),
  };
  if (view === "mine") where.assignedOfficerId = officer.id;
  if (view === "unassigned") where.assignedOfficerId = null;
  if (view === "sla") where.slaDueAt = { lt: new Date(Date.now() + 24 * 3_600_000) };
  if (view === "decision") where.status = "PENDING_DECISION";
  // FR-BO-001: by assigned officer (or unassigned); it narrows whatever the view shows.
  if (query.officer)
    where.assignedOfficerId = query.officer === QUEUE_UNASSIGNED ? null : query.officer;
  if (query.q) {
    where.OR = [
      { referenceNo: { contains: query.q, mode: "insensitive" } },
      { applicant: { fullName: { contains: query.q, mode: "insensitive" } } },
    ];
  }
  const page = query.page ?? 1;
  const sort = query.sort ?? "deadline";
  const include = {
    applicant: { select: { fullName: true } },
    assignedOfficer: { select: { id: true, fullName: true } },
  } as const;
  const skip = (page - 1) * QUEUE_PAGE_SIZE;

  const pageItems = async () => {
    if (sort !== "stale")
      return db.application.findMany({
        where,
        orderBy:
          sort === "submitted"
            ? [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
            : [{ slaDueAt: { sort: "asc", nulls: "last" } }, { submittedAt: "asc" }],
        skip,
        take: QUEUE_PAGE_SIZE,
        include,
      });
    const ids = await db.application.findMany({
      where,
      select: { id: true, updatedAt: true },
      take: STALE_SORT_LIMIT,
    });
    const since = await stateSince(ids.map((a) => a.id));
    const ordered = ids
      .map((a) => ({ id: a.id, at: since.get(a.id)?.getTime() ?? a.updatedAt.getTime() }))
      .sort((a, b) => a.at - b.at)
      .slice(skip, skip + QUEUE_PAGE_SIZE)
      .map((a) => a.id);
    const rows = await db.application.findMany({ where: { id: { in: ordered } }, include });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ordered.map((id) => byId.get(id)!).filter(Boolean);
  };

  const [total, rows, counts] = await Promise.all([
    db.application.count({ where }),
    pageItems(),
    db.application.groupBy({
      by: ["status"],
      where: { status: { in: [...WORKING] } },
      _count: { _all: true },
    }),
  ]);
  const [mine, since] = await Promise.all([
    db.application.count({
      where: { assignedOfficerId: officer.id, status: { in: [...WORKING] } },
    }),
    stateSince(rows.map((r) => r.id)),
  ]);
  // FR-BO-004: time in the current state, from the latest status event.
  const items = rows.map((row) => ({ ...row, inStateSince: since.get(row.id) ?? row.updatedAt }));
  return {
    total,
    items,
    page,
    mine,
    byStatus: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<
      string,
      number
    >,
  };
}

/** When each application entered its current state: its latest ApplicationEvent (FR-BO-004). */
export async function stateSince(applicationIds: readonly string[]): Promise<Map<string, Date>> {
  if (applicationIds.length === 0) return new Map();
  const rows = await db.applicationEvent.groupBy({
    by: ["applicationId"],
    where: { applicationId: { in: [...applicationIds] } },
    _max: { at: true },
  });
  return new Map(rows.filter((r) => r._max.at).map((r) => [r.applicationId, r._max.at!] as const));
}

/**
 * FR-BO-006: everything about the applicant, for the 360° panel — profile, applications, licences,
 * affiliations, licence history (suspensions, revocations…), payments and the last notifications
 * sent to them (communications).
 */
export async function applicantOverview(applicantId: string) {
  const [user, applications, licences, affiliations, licenceEvents, payments, notifications] =
    await Promise.all([
      db.user.findUnique({
        where: { id: applicantId },
        select: {
          fullName: true,
          email: true,
          phone: true,
          accountType: true,
          createdAt: true,
          mfaMethods: true,
        },
      }),
      db.application.findMany({
        where: { applicantId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          referenceNo: true,
          category: true,
          type: true,
          status: true,
          createdAt: true,
        },
      }),
      db.licence.findMany({
        where: { holderId: applicantId },
        orderBy: { issuedAt: "desc" },
        select: { id: true, licenceNo: true, category: true, status: true, expiresAt: true },
      }),
      db.affiliation.findMany({
        where: { licence: { holderId: applicantId } },
        orderBy: { startsOn: "desc" },
        take: 10,
        select: {
          id: true,
          startsOn: true,
          endsOn: true,
          endReason: true,
          firm: { select: { legalName: true, tradingName: true } },
          licence: { select: { licenceNo: true } },
        },
      }),
      db.licenceEvent.findMany({
        where: { licence: { holderId: applicantId } },
        orderBy: { at: "desc" },
        take: 10,
        select: {
          id: true,
          action: true,
          toStatus: true,
          reason: true,
          at: true,
          licence: { select: { licenceNo: true } },
        },
      }),
      db.payment.findMany({
        where: { application: { applicantId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          reference: true,
          amount: true,
          currency: true,
          status: true,
          receiptNo: true,
          paidAt: true,
          createdAt: true,
          application: { select: { referenceNo: true } },
        },
      }),
      db.notification.findMany({
        where: { userId: applicantId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, code: true, messageKey: true, values: true, createdAt: true },
      }),
    ]);
  return {
    user,
    applications,
    licences,
    affiliations,
    licenceEvents: licenceEvents.map((e) => ({ ...e, id: String(e.id) })),
    payments,
    notifications,
  };
}
