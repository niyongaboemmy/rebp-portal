import "server-only";
import { actionsIn, type AuditCategory } from "@/config/audit-actions";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { entityTerms, occurredRange, type AuditFilters } from "./filters";

/**
 * Audit trail reading model for the back-office timeline (FR-AUD-004): newest first, search by
 * actor, entity or reference, action and Kigali date range plus the category pills, cursor paging
 * by id. Actor names are resolved for display; metadata (no raw PII, ADR-007) is only read for the
 * actor role.
 */
export const PAGE_SIZE = 40;
/** Actor search matches at most this many accounts (an auditor narrows a broad term). */
const MAX_ACTORS = 200;

/** Prisma filter for the search (FR-AUD-004). Shared by the timeline and the signed export. */
export async function auditWhere(filters: AuditFilters): Promise<Prisma.AuditEventWhereInput> {
  const and: Prisma.AuditEventWhereInput[] = [];
  if (filters.category) and.push({ action: { in: actionsIn(filters.category) } });
  if (filters.action) and.push({ action: { contains: filters.action, mode: "insensitive" } });
  if (filters.entity) {
    const terms = entityTerms(filters.entity);
    if (terms.type || terms.id)
      and.push({
        entityType: { equals: terms.type, mode: "insensitive" },
        entityId: { contains: terms.id, mode: "insensitive" },
      });
    else
      and.push({
        OR: [
          { entityType: { equals: terms.any, mode: "insensitive" } },
          { entityId: { contains: terms.any, mode: "insensitive" } },
          // Applications, licences and payments carry their human reference in metadata.
          { metadata: { path: ["reference"], string_contains: terms.any } },
          { metadata: { path: ["licenceNo"], string_contains: terms.any } },
        ],
      });
  }
  const range = occurredRange(filters);
  if (range.gte || range.lt) and.push({ occurredAt: range });
  if (filters.actor) {
    const term = filters.actor;
    const actors = await db.user.findMany({
      where: {
        OR: [
          { fullName: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: MAX_ACTORS,
    });
    const system = /^(system|syst[eè]me|sisitemu)$/i.test(term);
    and.push(
      system
        ? { OR: [{ actorId: null }, { actorId: { in: actors.map((a) => a.id) } }] }
        : { actorId: { in: actors.map((a) => a.id) } },
    );
  }
  return and.length ? { AND: and } : {};
}

/** Display names for a page of events. */
export async function actorNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const actors = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true },
  });
  return new Map(actors.map((a) => [a.id, a.fullName]));
}

/** The role recorded with an event (FR-AUD-002); older events have none. */
export function actorRoleOf(metadata: unknown): string | null {
  const role = (metadata as { actorRole?: unknown } | null)?.actorRole;
  return typeof role === "string" ? role : null;
}

export interface TimelineEvent {
  id: string;
  occurredAt: Date;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  hash: string;
  actorName: string | null;
  actorRole: string | null;
}

export async function auditTimeline({
  category,
  before,
  filters = {},
}: {
  /** Kept for callers that only filter by category. */
  category?: AuditCategory;
  before?: bigint;
  filters?: AuditFilters;
}): Promise<{ events: TimelineEvent[]; nextCursor: string | null }> {
  const where = await auditWhere({ ...filters, ...(category ? { category } : {}) });
  const rows = await db.auditEvent.findMany({
    where: { AND: [where, ...(before ? [{ id: { lt: before } }] : [])] },
    orderBy: { id: "desc" },
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      occurredAt: true,
      action: true,
      entityType: true,
      entityId: true,
      ipAddress: true,
      hash: true,
      actorId: true,
      metadata: true,
    },
  });
  const page = rows.slice(0, PAGE_SIZE);
  const names = await actorNames(page.map((r) => r.actorId));
  return {
    events: page.map((r) => ({
      id: String(r.id),
      occurredAt: r.occurredAt,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      ipAddress: r.ipAddress,
      hash: r.hash,
      actorName: r.actorId ? (names.get(r.actorId) ?? null) : null,
      actorRole: actorRoleOf(r.metadata),
    })),
    nextCursor: rows.length > PAGE_SIZE ? String(page[page.length - 1]!.id) : null,
  };
}

/** Kigali-local day key (YYYY-MM-DD) for grouping. */
export function kigaliDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
