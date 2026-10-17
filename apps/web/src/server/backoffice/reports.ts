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

export async function financialReport() {
  const [paid, byMethod, waived, duplicates, outstanding, recent] = await Promise.all([
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
  ]);
  return {
    collected: paid._sum.amount ?? 0,
    paidCount: paid._count._all,
    byMethod: byMethod.map((m) => ({
      key: m.method ?? "UNKNOWN",
      amount: m._sum.amount ?? 0,
      count: m._count._all,
    })),
    waived: { amount: waived._sum.amount ?? 0, count: waived._count._all },
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
