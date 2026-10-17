import "server-only";
import { verifyAuditChain, type ChainVerification } from "../audit/audit";
import { db } from "../db";

/**
 * System health for administrators (FR-ADM-005): database round-trip, the last sign of the
 * scheduler, approvals still waiting for their licence (FR-N-009 retries), failed notification
 * deliveries and the audit chain. Aggregates only — no personal data.
 */
export const NOTIFICATION_WINDOW_DAYS = 7;
/** Jobs run at least daily; older evidence than this is flagged. */
export const JOB_STALE_HOURS = 26;
/** Issuance retries run a minute after the decision (see retryPendingIssuance). */
const ISSUANCE_GRACE_MS = 60_000;

/** Audit actions only the scheduled jobs write (actor = system). "jobs.run" is forward-compatible. */
const JOB_ACTIONS = ["jobs.run", "licence.expired", "licence.lapsed"];

export interface SystemHealth {
  checkedAt: Date;
  database: { ok: boolean; latencyMs: number | null };
  jobs: { lastRunAt: Date | null; stale: boolean };
  issuance: { pending: number; oldestDecidedAt: Date | null };
  notifications: { failed: number; total: number; lastFailedAt: Date | null; windowDays: number };
  chain: ChainVerification | null;
  queue: { open: number; breached: number };
}

async function databaseLatency(): Promise<SystemHealth["database"]> {
  const started = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Math.round((performance.now() - started) * 10) / 10 };
  } catch {
    return { ok: false, latencyMs: null };
  }
}

/** Newest of two optional dates. */
export function latest(...dates: Array<Date | null | undefined>): Date | null {
  return dates.reduce<Date | null>((max, d) => (d && (!max || d > max) ? d : max), null);
}

export function isStale(lastRunAt: Date | null, now: Date, hours = JOB_STALE_HOURS): boolean {
  return !lastRunAt || now.getTime() - lastRunAt.getTime() > hours * 3_600_000;
}

export async function systemHealth(now = new Date()): Promise<SystemHealth> {
  const database = await databaseLatency();
  if (!database.ok)
    return {
      checkedAt: now,
      database,
      jobs: { lastRunAt: null, stale: true },
      issuance: { pending: 0, oldestDecidedAt: null },
      notifications: {
        failed: 0,
        total: 0,
        lastFailedAt: null,
        windowDays: NOTIFICATION_WINDOW_DAYS,
      },
      chain: null,
      queue: { open: 0, breached: 0 },
    };
  const since = new Date(now.getTime() - NOTIFICATION_WINDOW_DAYS * 86_400_000);
  const open = ["SUBMITTED", "UNDER_REVIEW", "FURTHER_ASSESSMENT", "PENDING_DECISION"] as const;
  const [reminder, jobEvent, pending, failed, total, lastFailed, chain, openCount, breached] =
    await Promise.all([
      db.reminderLog.findFirst({ orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
      db.auditEvent.findFirst({
        where: { actorId: null, action: { in: JOB_ACTIONS } },
        orderBy: { id: "desc" },
        select: { occurredAt: true },
      }),
      db.application.aggregate({
        where: {
          status: { in: ["APPROVED", "APPROVED_WITH_CONDITIONS"] },
          decidedAt: { lt: new Date(now.getTime() - ISSUANCE_GRACE_MS) },
        },
        _count: { _all: true },
        _min: { decidedAt: true },
      }),
      db.notificationLog.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
      db.notificationLog.count({ where: { createdAt: { gte: since } } }),
      db.notificationLog.findFirst({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      verifyAuditChain(),
      db.application.count({ where: { status: { in: [...open] } } }),
      db.application.count({ where: { status: { in: [...open] }, slaDueAt: { lt: now } } }),
    ]);
  const lastRunAt = latest(reminder?.sentAt, jobEvent?.occurredAt);
  return {
    checkedAt: now,
    database,
    jobs: { lastRunAt, stale: isStale(lastRunAt, now) },
    issuance: { pending: pending._count._all, oldestDecidedAt: pending._min.decidedAt ?? null },
    notifications: {
      failed,
      total,
      lastFailedAt: lastFailed?.createdAt ?? null,
      windowDays: NOTIFICATION_WINDOW_DAYS,
    },
    chain,
    queue: { open: openCount, breached },
  };
}
