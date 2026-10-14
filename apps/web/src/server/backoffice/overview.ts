import "server-only";
import type { Role } from "@rebp/contracts";
import { db } from "@/server/db";

/**
 * Back-office overview metrics (FR-RPT-001, FR-ADM-005). Aggregates only — no personal data
 * leaves this module. Days are bucketed in Africa/Kigali time (SRS §2.3).
 */
const TZ = "Africa/Kigali";

export interface DayCount {
  /** YYYY-MM-DD in Kigali time. */
  day: string;
  count: number;
}

/** The last `days` calendar days (oldest first), zero-filled. */
export function lastDays(days: number, now = new Date()): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return Array.from({ length: days }, (_, i) =>
    fmt.format(new Date(now.getTime() - (days - 1 - i) * 86_400_000)),
  );
}

export function zeroFill(rows: { day: string; count: number }[], days: string[]): DayCount[] {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  return days.map((day) => ({ day, count: byDay.get(day) ?? 0 }));
}

export async function auditActivity(days = 14): Promise<DayCount[]> {
  const range = lastDays(days);
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db.$queryRaw<{ day: string; count: number }[]>`
    SELECT to_char(("occurredAt" AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day, count(*)::int AS count
    FROM "AuditEvent"
    WHERE "occurredAt" >= ${since}
    GROUP BY 1`;
  return zeroFill(rows, range);
}

export interface AccountStats {
  total: number;
  newThisWeek: number;
  withTwoStep: number;
  activeSessions: number;
  signUps: DayCount[];
  byRole: { role: Role; count: number }[];
}

export async function accountStats(days = 14): Promise<AccountStats> {
  const now = new Date();
  const range = lastDays(days, now);
  const since = new Date(now.getTime() - days * 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [total, newThisWeek, withTwoStep, activeSessions, signUps, byRole] = await Promise.all([
    db.user.count({ where: { disabledAt: null } }),
    db.user.count({ where: { disabledAt: null, createdAt: { gte: weekAgo } } }),
    db.user.count({ where: { disabledAt: null, NOT: { mfaMethods: { isEmpty: true } } } }),
    db.session.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    db.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM "User"
      WHERE "createdAt" >= ${since}
      GROUP BY 1`,
    db.$queryRaw<{ role: Role; count: number }[]>`
      SELECT unnest(roles)::text AS role, count(*)::int AS count
      FROM "User"
      WHERE "disabledAt" IS NULL
      GROUP BY 1
      ORDER BY 2 DESC`,
  ]);
  return {
    total,
    newThisWeek,
    withTwoStep,
    activeSessions,
    signUps: zeroFill(signUps, range),
    byRole,
  };
}
