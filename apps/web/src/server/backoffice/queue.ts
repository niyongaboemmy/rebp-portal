import "server-only";
import type { QueueQuery } from "@rebp/contracts";
import type { Prisma, User } from "@/generated/prisma/client";
import { db } from "../db";

/**
 * Work queues (WP-3.1/3.2, FR-BO-001, FR-BO-004): filters by status, category, type and reference
 * or name; views for "mine", "unassigned", "SLA risk" and "awaiting decision". Filters live in the
 * URL, so a view can be saved as a bookmark and shared.
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
  if (query.q) {
    where.OR = [
      { referenceNo: { contains: query.q, mode: "insensitive" } },
      { applicant: { fullName: { contains: query.q, mode: "insensitive" } } },
    ];
  }
  const page = query.page ?? 1;
  const [total, items, counts] = await Promise.all([
    db.application.count({ where }),
    db.application.findMany({
      where,
      orderBy: [{ slaDueAt: { sort: "asc", nulls: "last" } }, { submittedAt: "asc" }],
      skip: (page - 1) * QUEUE_PAGE_SIZE,
      take: QUEUE_PAGE_SIZE,
      include: {
        applicant: { select: { fullName: true } },
        assignedOfficer: { select: { id: true, fullName: true } },
      },
    }),
    db.application.groupBy({
      by: ["status"],
      where: { status: { in: [...WORKING] } },
      _count: { _all: true },
    }),
  ]);
  const mine = await db.application.count({
    where: { assignedOfficerId: officer.id, status: { in: [...WORKING] } },
  });
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

/** FR-BO-006: everything about the applicant, for the 360° panel. */
export async function applicantOverview(applicantId: string) {
  const [user, applications, licences] = await Promise.all([
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
  ]);
  return { user, applications, licences };
}
