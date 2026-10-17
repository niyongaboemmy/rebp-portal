import "server-only";
import { addDaysTo } from "../time";
import { db } from "../db";

/**
 * Reporting (WP-4.5, FR-RPT-001…003, FR-RPT-005). Aggregates only — no personal data leaves these
 * queries except in the access-restricted CSV exports.
 */
export async function operationalReport() {
  const now = new Date();
  const [
    byStatus,
    byCategory,
    byType,
    decisions,
    reviews,
    infoRequests,
    submitted,
    breached,
    overrides,
  ] = await Promise.all([
    db.application.groupBy({ by: ["status"], _count: { _all: true } }),
    db.application.groupBy({
      by: ["category"],
      where: { status: { notIn: ["DRAFT", "EXPIRED_DRAFT"] } },
      _count: { _all: true },
    }),
    db.application.groupBy({
      by: ["type"],
      where: { status: { notIn: ["DRAFT", "EXPIRED_DRAFT"] } },
      _count: { _all: true },
    }),
    db.decision.groupBy({ by: ["decision"], _count: { _all: true } }),
    db.review.findMany({
      where: { signedAt: { gte: addDaysTo(now, -30) } },
      select: { officer: { select: { fullName: true } } },
    }),
    db.informationRequest.count(),
    db.application.count({ where: { submittedAt: { not: null } } }),
    db.application.count({
      where: {
        slaDueAt: { lt: now },
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "FURTHER_ASSESSMENT", "PENDING_DECISION"] },
      },
    }),
    db.review.findMany({ where: { signedAt: { not: null } }, select: { computed: true } }),
  ]);
  const throughput = new Map<string, number>();
  for (const r of reviews)
    throughput.set(r.officer.fullName, (throughput.get(r.officer.fullName) ?? 0) + 1);
  const overridden = overrides.filter((r) => {
    const o = (r.computed as { overridden?: { documentation?: boolean; eligibility?: boolean } })
      ?.overridden;
    return o?.documentation || o?.eligibility;
  }).length;
  const open = byStatus
    .filter((s) =>
      ["SUBMITTED", "UNDER_REVIEW", "FURTHER_ASSESSMENT", "PENDING_DECISION"].includes(s.status),
    )
    .reduce((sum, s) => sum + s._count._all, 0);
  return {
    byStatus: byStatus.map((s) => ({ key: s.status, count: s._count._all })),
    byCategory: byCategory.map((s) => ({ key: s.category, count: s._count._all })),
    byType: byType.map((s) => ({ key: s.type, count: s._count._all })),
    decisions: decisions.map((d) => ({ key: d.decision, count: d._count._all })),
    throughput: [...throughput.entries()]
      .map(([name, count]) => ({ key: name, count }))
      .sort((a, b) => b.count - a.count),
    infoRequestRate: submitted > 0 ? infoRequests / submitted : 0,
    submitted,
    open,
    breached,
    slaCompliance: open > 0 ? 1 - breached / open : 1,
    overridden,
  };
}

// ---------------------------------------------------------------------------
// FR-RPT-001: rejection reasons and review recommendations
// ---------------------------------------------------------------------------

export interface KeyCount {
  key: string;
  count: number;
}

/** Counts every code across rows (a row may carry several), most frequent first. */
export function countCodes(rows: ReadonlyArray<{ codes: readonly string[] }>): KeyCount[] {
  const counts = new Map<string, number>();
  for (const row of rows)
    for (const code of new Set(row.codes)) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Signed reviews, latest version per application only (an amendment replaces the earlier one). */
function latestPerApplication<T extends { applicationId: string; version: number }>(rows: T[]) {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const seen = latest.get(row.applicationId);
    if (!seen || row.version > seen.version) latest.set(row.applicationId, row);
  }
  return [...latest.values()];
}

export async function reasonsReport() {
  const [rejected, reviews] = await Promise.all([
    db.decision.findMany({
      where: { decision: { in: ["REJECTED", "DEFERRED"] }, correctsId: null },
      select: { decision: true, reasonCodes: true },
    }),
    db.review.findMany({
      where: { signedAt: { not: null } },
      select: { applicationId: true, version: true, recommendation: true, reasonCodes: true },
    }),
  ]);
  const signed = latestPerApplication(reviews);
  const recommendations = countCodes(
    signed.map((r) => ({ codes: r.recommendation ? [r.recommendation] : [] })),
  );
  return {
    /** Reason codes on rejection decisions (FR-M-008). */
    rejectionReasons: countCodes(
      rejected.filter((d) => d.decision === "REJECTED").map((d) => ({ codes: d.reasonCodes })),
    ),
    rejections: rejected.filter((d) => d.decision === "REJECTED").length,
    deferrals: rejected.filter((d) => d.decision === "DEFERRED").length,
    /** Officers' recommendations on signed reviews (FR-L-009). */
    recommendations,
    /** Reason codes officers gave when recommending rejection. */
    reviewReasons: countCodes(
      signed.filter((r) => r.recommendation === "REJECT").map((r) => ({ codes: r.reasonCodes })),
    ),
  };
}

// ---------------------------------------------------------------------------
// FR-RPT-003: revenue by fee type and by month, refunds and waivers
// ---------------------------------------------------------------------------

export const FEE_GROUPS = ["registration", "licensing", "latePenalty", "other"] as const;
export type FeeGroup = (typeof FEE_GROUPS)[number];

/** Fee line code → reporting group: renewals are licensing fees (FR-PAY-002). */
export function feeGroupOf(code: unknown): FeeGroup {
  if (code === "registration") return "registration";
  if (code === "licensing" || code === "renewal") return "licensing";
  if (code === "latePenalty") return "latePenalty";
  return "other";
}

/** YYYY-MM in Kigali time. */
export function kigaliMonth(date: Date): string {
  return new Date(date.getTime() + 2 * 3_600_000).toISOString().slice(0, 7);
}

/** The last `count` Kigali months, oldest first. */
export function lastMonths(count: number, now = new Date()): string[] {
  const [y, m] = kigaliMonth(now).split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

export interface RevenuePayment {
  amount: number;
  lines: unknown;
  paidAt: Date | null;
  createdAt: Date;
}

/**
 * Splits collected payments into fee groups using their itemised lines (FR-PAY-001). Any
 * difference between the lines and the amount charged (rounding, legacy rows) is "other", so the
 * groups always add up to what was collected.
 */
export function revenueBreakdown(payments: readonly RevenuePayment[], months: readonly string[]) {
  const byType = new Map<FeeGroup, number>(FEE_GROUPS.map((g) => [g, 0]));
  const byMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const p of payments) {
    let itemised = 0;
    for (const line of Array.isArray(p.lines) ? p.lines : []) {
      const { code, amount } = (line ?? {}) as { code?: unknown; amount?: unknown };
      if (typeof amount !== "number" || !Number.isFinite(amount)) continue;
      byType.set(feeGroupOf(code), byType.get(feeGroupOf(code))! + amount);
      itemised += amount;
    }
    if (itemised !== p.amount) byType.set("other", byType.get("other")! + (p.amount - itemised));
    const month = kigaliMonth(p.paidAt ?? p.createdAt);
    if (byMonth.has(month)) byMonth.set(month, byMonth.get(month)! + p.amount);
  }
  return {
    byFeeType: FEE_GROUPS.map((key) => ({ key, amount: byType.get(key)! })).filter(
      (g) => g.key !== "other" || g.amount !== 0,
    ),
    byMonth: [...byMonth.entries()].map(([month, amount]) => ({ month, amount })),
  };
}

export const REVENUE_MONTHS = 12;

export async function financialReport() {
  const [paid, byMethod, waived, duplicates, outstanding, recent, collected, refunded] =
    await Promise.all([
      db.payment.aggregate({
        where: { status: "PAID", duplicate: false },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.payment.groupBy({
        by: ["method"],
        where: { status: "PAID" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.payment.aggregate({
        where: { status: "WAIVED" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.payment.count({ where: { duplicate: true } }),
      db.application.count({ where: { status: "PENDING_PAYMENT" } }),
      db.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          application: { select: { referenceNo: true, category: true, status: true, id: true } },
        },
      }),
      db.payment.findMany({
        where: { status: "PAID", duplicate: false },
        select: { amount: true, lines: true, paidAt: true, createdAt: true },
      }),
      db.payment.aggregate({
        where: { status: "REFUNDED" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
  const revenue = revenueBreakdown(collected, lastMonths(REVENUE_MONTHS));
  return {
    collected: paid._sum.amount ?? 0,
    paidCount: paid._count._all,
    byMethod: byMethod.map((m) => ({
      key: m.method ?? "UNKNOWN",
      amount: m._sum.amount ?? 0,
      count: m._count._all,
    })),
    waived: { amount: waived._sum.amount ?? 0, count: waived._count._all },
    refunded: { amount: refunded._sum.amount ?? 0, count: refunded._count._all },
    /** FR-RPT-003: collected revenue by fee type and by Kigali month (last 12). */
    byFeeType: revenue.byFeeType,
    byMonth: revenue.byMonth,
    duplicates,
    outstanding,
    recent,
  };
}

export async function registerReport() {
  const now = new Date();
  const [byCategory, byStatus, expiring, firms] = await Promise.all([
    db.licence.groupBy({ by: ["category"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    db.licence.groupBy({ by: ["status"], _count: { _all: true } }),
    db.licence.count({ where: { status: "ACTIVE", expiresAt: { lte: addDaysTo(now, 90) } } }),
    db.firm.count({ where: { status: "ACTIVE" } }),
  ]);
  return {
    byCategory: byCategory.map((c) => ({ key: c.category, count: c._count._all })),
    byStatus: byStatus.map((s) => ({ key: s.status, count: s._count._all })),
    expiring,
    firms,
  };
}

/** CSV with formula-injection protection (cells starting with = + - @ are quoted with '). */
export function toCsv(
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const cell = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\n") + "\n";
}

export async function applicationsCsv() {
  const apps = await db.application.findMany({
    where: { status: { notIn: ["DRAFT", "EXPIRED_DRAFT"] } },
    orderBy: { submittedAt: "desc" },
    take: 5000,
    include: { assignedOfficer: { select: { fullName: true } } },
  });
  return toCsv(
    [
      "reference",
      "type",
      "category",
      "status",
      "submittedAt",
      "decidedAt",
      "officer",
      "eligibility",
    ],
    apps.map((a) => [
      a.referenceNo,
      a.type,
      a.category,
      a.status,
      a.submittedAt?.toISOString() ?? "",
      a.decidedAt?.toISOString() ?? "",
      a.assignedOfficer?.fullName ?? "",
      a.eligibilityOutcome ?? "",
    ]),
  );
}

/** FR-RPT-001/005: decided applications with the decision's reasons and the review's recommendation. */
export async function applicationsByReasonCsv() {
  const apps = await db.application.findMany({
    where: { decidedAt: { not: null } },
    orderBy: { decidedAt: "desc" },
    take: 5000,
    select: {
      referenceNo: true,
      type: true,
      category: true,
      status: true,
      decidedAt: true,
      decisions: {
        orderBy: { signedAt: "desc" },
        take: 1,
        select: { decision: true, reasonCodes: true },
      },
      reviews: {
        where: { signedAt: { not: null } },
        orderBy: { version: "desc" },
        take: 1,
        select: { recommendation: true, reasonCodes: true },
      },
    },
  });
  return toCsv(
    [
      "reference",
      "type",
      "category",
      "status",
      "decision",
      "decisionReasons",
      "recommendation",
      "reviewReasons",
      "decidedAt",
    ],
    apps.map((a) => [
      a.referenceNo,
      a.type,
      a.category,
      a.status,
      a.decisions[0]?.decision ?? "",
      (a.decisions[0]?.reasonCodes ?? []).join(";"),
      a.reviews[0]?.recommendation ?? "",
      (a.reviews[0]?.reasonCodes ?? []).join(";"),
      a.decidedAt?.toISOString() ?? "",
    ]),
  );
}

export async function paymentsCsv() {
  const payments = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { application: { select: { referenceNo: true, category: true } } },
  });
  return toCsv(
    [
      "payment",
      "application",
      "category",
      "amount",
      "currency",
      "method",
      "status",
      "receipt",
      "paidAt",
      "duplicate",
    ],
    payments.map((p) => [
      p.reference,
      p.application.referenceNo,
      p.application.category,
      p.amount,
      p.currency,
      p.method ?? "",
      p.status,
      p.receiptNo ?? "",
      p.paidAt?.toISOString() ?? "",
      p.duplicate ? "yes" : "no",
    ]),
  );
}
