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

/** The review pipeline as stage counts (UX-032): where every open application sits right now. */
export const PIPELINE = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_DECISION",
] as const;

export async function pipelineCounts(now = new Date()) {
  const [rows, decidedThisWeek] = await Promise.all([
    db.application.groupBy({
      by: ["status"],
      where: { status: { in: [...PIPELINE] } },
      _count: { _all: true },
    }),
    db.application.count({
      where: { decidedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
    }),
  ]);
  const counts = Object.fromEntries(PIPELINE.map((s) => [s, 0])) as Record<
    (typeof PIPELINE)[number],
    number
  >;
  for (const row of rows) counts[row.status as (typeof PIPELINE)[number]] = row._count._all;
  return { counts, decidedThisWeek };
}

/** The officer's own files past their service-level date (the overview's most urgent item). */
export async function myOverdue(officerId: string, now = new Date()) {
  return db.application.count({
    where: {
      assignedOfficerId: officerId,
      slaDueAt: { lt: now },
      status: { in: ["SUBMITTED", "UNDER_REVIEW", "FURTHER_ASSESSMENT"] },
    },
  });
}

/* ---- Dashboard v2 (UX-040): series and breakdowns for the interactive overview. ---------------- */

export interface FlowDay {
  /** YYYY-MM-DD in Kigali time. */
  day: string;
  submitted: number;
  decided: number;
}

/** Applications in (submitted) and out (decided) per day — whether the backlog grows or shrinks. */
export async function flowSeries(days = 30, now = new Date()): Promise<FlowDay[]> {
  const range = lastDays(days, now);
  const since = new Date(now.getTime() - days * 86_400_000);
  const [submitted, decided] = await Promise.all([
    db.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char(("submittedAt" AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM "Application" WHERE "submittedAt" >= ${since} GROUP BY 1`,
    db.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char(("decidedAt" AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM "Application" WHERE "decidedAt" >= ${since} GROUP BY 1`,
  ]);
  const ins = zeroFill(submitted, range);
  const outs = zeroFill(decided, range);
  return range.map((day, i) => ({ day, submitted: ins[i]!.count, decided: outs[i]!.count }));
}

export type PipelineStage = (typeof PIPELINE)[number];

export interface StageDetail {
  stage: PipelineStage;
  count: number;
  /** Mean days since submission for files in this stage. */
  avgAgeDays: number;
  /** The longest-waiting files: reference numbers only (no personal data). */
  oldest: { referenceNo: string; days: number }[];
}

export async function pipelineDetail(now = new Date()): Promise<StageDetail[]> {
  const [ages, oldest] = await Promise.all([
    db.$queryRaw<{ status: PipelineStage; count: number; avg: number | null }[]>`
      SELECT status::text AS status, count(*)::int AS count,
             avg(extract(epoch FROM (${now}::timestamptz - coalesce("submittedAt", "createdAt"))) / 86400)::float AS avg
      FROM "Application" WHERE status::text = ANY(${[...PIPELINE]}) GROUP BY 1`,
    db.$queryRaw<{ status: PipelineStage; referenceNo: string; days: number }[]>`
      SELECT status, "referenceNo", days FROM (
        SELECT status::text AS status, "referenceNo",
               floor(extract(epoch FROM (${now}::timestamptz - coalesce("submittedAt", "createdAt"))) / 86400)::int AS days,
               row_number() OVER (PARTITION BY status ORDER BY coalesce("submittedAt", "createdAt")) AS rank
        FROM "Application" WHERE status::text = ANY(${[...PIPELINE]})
      ) ranked WHERE rank <= 3 ORDER BY status, days DESC`,
  ]);
  return PIPELINE.map((stage) => {
    const row = ages.find((a) => a.status === stage);
    return {
      stage,
      count: row?.count ?? 0,
      avgAgeDays: Math.round((row?.avg ?? 0) * 10) / 10,
      oldest: oldest
        .filter((o) => o.status === stage)
        .map(({ referenceNo, days }) => ({ referenceNo, days })),
    };
  });
}

export interface SlaHealth {
  overdue: number;
  /** Due within 2 days. */
  dueSoon: number;
  /** Due in 3–7 days. */
  dueWeek: number;
  /** Due later than a week. */
  onTrack: number;
  /** The most overdue files: reference numbers only. */
  urgent: { referenceNo: string; status: PipelineStage; daysOver: number }[];
}

/** Service-level health of every open file with a due date (FR-RPT-001). */
export async function slaHealth(now = new Date()): Promise<SlaHealth> {
  const [buckets, urgent] = await Promise.all([
    db.$queryRaw<{ bucket: string; count: number }[]>`
      SELECT CASE
               WHEN "slaDueAt" < ${now} THEN 'overdue'
               WHEN "slaDueAt" < ${now}::timestamptz + interval '2 days' THEN 'dueSoon'
               WHEN "slaDueAt" < ${now}::timestamptz + interval '7 days' THEN 'dueWeek'
               ELSE 'onTrack' END AS bucket,
             count(*)::int AS count
      FROM "Application"
      WHERE "slaDueAt" IS NOT NULL AND status::text = ANY(${[...PIPELINE]})
      GROUP BY 1`,
    db.$queryRaw<{ referenceNo: string; status: PipelineStage; daysOver: number }[]>`
      SELECT "referenceNo", status::text AS status,
             ceil(extract(epoch FROM (${now}::timestamptz - "slaDueAt")) / 86400)::int AS "daysOver"
      FROM "Application"
      WHERE "slaDueAt" < ${now} AND status::text = ANY(${[...PIPELINE]})
      ORDER BY "slaDueAt" LIMIT 6`,
  ]);
  const get = (b: string) => buckets.find((r) => r.bucket === b)?.count ?? 0;
  return {
    overdue: get("overdue"),
    dueSoon: get("dueSoon"),
    dueWeek: get("dueWeek"),
    onTrack: get("onTrack"),
    urgent,
  };
}

/** Signed decisions by outcome (corrections excluded), over the last `days`. */
export async function decisionMix(
  days = 30,
  now = new Date(),
): Promise<{ outcome: string; count: number }[]> {
  const rows = await db.decision.groupBy({
    by: ["decision"],
    where: { correctsId: null, signedAt: { gte: new Date(now.getTime() - days * 86_400_000) } },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ outcome: r.decision, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}
