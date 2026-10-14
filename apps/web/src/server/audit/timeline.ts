import "server-only";
import { actionsIn, type AuditCategory } from "@/config/audit-actions";
import { db } from "@/server/db";

/**
 * Audit trail reading model for the back-office timeline (FR-AUD-004): newest first, optional
 * category filter, cursor paging by id. Actor names are resolved for display; metadata (which
 * holds no raw PII, ADR-007) is not loaded.
 */
export const PAGE_SIZE = 40;

export interface TimelineEvent {
  id: string;
  occurredAt: Date;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  hash: string;
  actorName: string | null;
}

export async function auditTimeline({
  category,
  before,
}: {
  category?: AuditCategory;
  before?: bigint;
}): Promise<{ events: TimelineEvent[]; nextCursor: string | null }> {
  const rows = await db.auditEvent.findMany({
    where: {
      ...(category ? { action: { in: actionsIn(category) } } : {}),
      ...(before ? { id: { lt: before } } : {}),
    },
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
    },
  });
  const page = rows.slice(0, PAGE_SIZE);
  const actorIds = [
    ...new Set(page.map((r) => r.actorId).filter((id): id is string => Boolean(id))),
  ];
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const names = new Map(actors.map((a) => [a.id, a.fullName]));
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
