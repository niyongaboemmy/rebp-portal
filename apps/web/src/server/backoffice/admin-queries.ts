import "server-only";
import { redirect } from "next/navigation";
import type { Capability, ConfigKey } from "@rebp/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { userCapabilities } from "../access/permissions";
import { requireUser } from "../auth/guards";
import { db } from "../db";
import { feeQuote } from "../payments/payments";
import { addDaysTo } from "../time";

/**
 * Read queries for the administration consoles (WP-4.3/4.4/4.5, WP-2.5): register search and
 * licence detail (FR-RA-001/002), applications awaiting payment (FR-PAY-008), configuration history
 * with names (FR-ADM-002…004), and the overview counts (FR-RPT-001). Writes stay in their domain
 * modules behind server actions.
 */

/** Page guard for consoles open to several capabilities (e.g. maker or checker). */
export async function requireAnyCapability(capabilities: readonly Capability[]) {
  const current = await requireUser();
  const effective = await userCapabilities(current.user);
  if (!capabilities.some((c) => effective.includes(c))) redirect("/forbidden");
  return { ...current, capabilities: effective };
}

const WORKING = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_DECISION",
  "PENDING_CONFIRMATIONS",
] as const;
const OPEN = ["SUBMITTED", "UNDER_REVIEW", "FURTHER_ASSESSMENT", "PENDING_DECISION"] as const;

// ---------------------------------------------------------------------------
// Register administration (FR-RA-001/002)
// ---------------------------------------------------------------------------

export const LICENCE_PAGE_SIZE = 20;

export async function searchLicences({ q, page = 1 }: { q?: string; page?: number }) {
  const term = q?.trim();
  const where: Prisma.LicenceWhereInput = term
    ? {
        OR: [
          { licenceNo: { contains: term, mode: "insensitive" } },
          { displayName: { contains: term, mode: "insensitive" } },
          { registrant: { registrationNo: { contains: term, mode: "insensitive" } } },
        ],
      }
    : {};
  const [total, items] = await Promise.all([
    db.licence.count({ where }),
    db.licence.findMany({
      where,
      orderBy: [{ issuedAt: "desc" }, { licenceNo: "asc" }],
      skip: (page - 1) * LICENCE_PAGE_SIZE,
      take: LICENCE_PAGE_SIZE,
      select: {
        id: true,
        licenceNo: true,
        displayName: true,
        holderId: true,
        category: true,
        status: true,
        expiresAt: true,
        flags: true,
        registrant: { select: { registrationNo: true } },
        firm: { select: { legalName: true, tradingName: true } },
        affiliatedFirm: { select: { legalName: true, tradingName: true } },
        _count: { select: { registerActions: { where: { status: "PENDING" } } } },
      },
    }),
  ]);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / LICENCE_PAGE_SIZE)),
    items: items.map(({ firm, affiliatedFirm, registrant, _count, ...l }) => ({
      ...l,
      registrationNo: registrant.registrationNo,
      firmName: firmName(firm ?? affiliatedFirm),
      pending: _count.registerActions > 0,
    })),
  };
}

const firmName = (firm: { legalName: string; tradingName: string | null } | null) =>
  firm ? (firm.tradingName ?? firm.legalName) : null;

/** One licence with its append-only event history and any pending register action. */
export async function licenceAdminDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const licence = await db.licence.findUnique({
    where: { id },
    select: {
      id: true,
      licenceNo: true,
      displayName: true,
      category: true,
      status: true,
      issuedAt: true,
      expiresAt: true,
      flags: true,
      certificateVersion: true,
      registrant: { select: { registrationNo: true } },
      holder: { select: { fullName: true } },
      firm: { select: { legalName: true, tradingName: true } },
      affiliatedFirm: { select: { legalName: true, tradingName: true } },
      events: { orderBy: { at: "desc" }, take: 50 },
      registerActions: {
        where: { status: "PENDING" },
        select: { id: true, action: true, createdAt: true },
      },
    },
  });
  if (!licence) return null;
  const actorIds = [...new Set(licence.events.map((e) => e.actorId).filter(Boolean))] as string[];
  const actors = await namesOf(actorIds);
  const { firm, affiliatedFirm, registrant, holder, events, registerActions, ...rest } = licence;
  return {
    ...rest,
    registrationNo: registrant.registrationNo,
    holderName: holder?.fullName ?? null,
    firmName: firmName(firm ?? affiliatedFirm),
    pending: registerActions[0] ?? null,
    events: events.map((e) => ({
      id: String(e.id),
      action: e.action,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      reason: e.reason,
      reference: e.reference,
      startsOn: e.startsOn,
      endsOn: e.endsOn,
      at: e.at,
      actorName: e.actorId ? (actors.get(e.actorId) ?? null) : null,
    })),
  };
}
export type LicenceAdminDetail = NonNullable<Awaited<ReturnType<typeof licenceAdminDetail>>>;

async function namesOf(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

/** Pending register actions with the maker's name (maker-checker queue, FR-RA-001). */
export async function pendingRegisterQueue() {
  const rows = await db.registerAction.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      licence: {
        select: { id: true, licenceNo: true, displayName: true, category: true, status: true },
      },
    },
  });
  const makers = await namesOf([...new Set(rows.map((r) => r.makerId))]);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    reason: r.reason,
    reference: r.reference,
    payload: r.payload as {
      startsOn?: string | null;
      endsOn?: string | null;
      displayName?: string | null;
    },
    createdAt: r.createdAt,
    makerId: r.makerId,
    makerName: makers.get(r.makerId) ?? null,
    licence: r.licence,
  }));
}
export type PendingRegisterRow = Awaited<ReturnType<typeof pendingRegisterQueue>>[number];

// ---------------------------------------------------------------------------
// Finance (FR-PAY-008/010/011)
// ---------------------------------------------------------------------------

export async function awaitingPayment() {
  const apps = await db.application.findMany({
    where: { status: "PENDING_PAYMENT" },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: {
      id: true,
      referenceNo: true,
      category: true,
      type: true,
      lateRenewal: true,
      updatedAt: true,
      applicantId: true,
      applicant: { select: { fullName: true } },
    },
  });
  return Promise.all(
    apps.map(async ({ applicant, ...a }) => ({
      ...a,
      applicantName: applicant.fullName,
      amount: (await feeQuote(a)).total,
    })),
  );
}

// ---------------------------------------------------------------------------
// Configuration (FR-ADM-002…004)
// ---------------------------------------------------------------------------

export async function configVersions(key: ConfigKey) {
  const rows = await db.configVersion.findMany({
    where: { key },
    orderBy: { version: "desc" },
    take: 20,
  });
  const names = await namesOf([
    ...new Set(rows.flatMap((r) => [r.makerId, r.checkerId]).filter(Boolean)),
  ] as string[]);
  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    status: r.status,
    value: r.value,
    effectiveFrom: r.effectiveFrom,
    reason: r.reason,
    note: r.note,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
    makerId: r.makerId,
    makerName: names.get(r.makerId) ?? null,
    checkerName: r.checkerId ? (names.get(r.checkerId) ?? null) : null,
  }));
}
export type ConfigVersionRow = Awaited<ReturnType<typeof configVersions>>[number];

// ---------------------------------------------------------------------------
// Overview (FR-RPT-001)
// ---------------------------------------------------------------------------

/** Live counts for the console tiles; only the consoles the user can open are counted. */
export async function consoleCounts(userId: string, capabilities: readonly Capability[]) {
  const has = (c: Capability) => capabilities.includes(c);
  const [queue, decisions, register, finance, configuration] = await Promise.all([
    has("review.perform")
      ? db.application.count({ where: { assignedOfficerId: userId, status: { in: [...WORKING] } } })
      : null,
    // BR-091: files this person reviewed or was assigned aren't theirs to decide.
    has("decision.make")
      ? db.application.count({
          where: {
            status: "PENDING_DECISION",
            OR: [{ assignedOfficerId: null }, { assignedOfficerId: { not: userId } }],
            reviews: { none: { officerId: userId } },
          },
        })
      : null,
    has("register.administer") || has("register.revoke")
      ? db.registerAction.count({ where: { status: "PENDING" } })
      : null,
    has("payments.manage") || has("payments.view")
      ? db.application.count({ where: { status: "PENDING_PAYMENT" } })
      : null,
    has("config.edit") || has("config.approve")
      ? db.configVersion.count({ where: { status: "PENDING" } })
      : null,
  ]);
  return { queue, decisions, register, finance, configuration };
}

/** Application KPIs for staff with review.view. */
export async function applicationKpis(now = new Date()) {
  const [submittedThisWeek, underReview, awaitingDecision, slaBreaches] = await Promise.all([
    db.application.count({ where: { submittedAt: { gte: addDaysTo(now, -7) } } }),
    db.application.count({ where: { status: { in: ["UNDER_REVIEW", "FURTHER_ASSESSMENT"] } } }),
    db.application.count({ where: { status: "PENDING_DECISION" } }),
    db.application.count({ where: { slaDueAt: { lt: now }, status: { in: [...OPEN] } } }),
  ]);
  return { submittedThisWeek, underReview, awaitingDecision, slaBreaches };
}
