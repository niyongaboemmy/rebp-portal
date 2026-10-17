import { beforeEach, describe, expect, it } from "vitest";
import {
  applicationsByReasonCsv,
  financialReport,
  reasonsReport,
} from "@/server/backoffice/reports";
import { db } from "@/server/db";
import { resetDatabase } from "@/test/db";
import { makeUser } from "@/test/fixtures";

/** FR-RPT-001/003 aggregations against the database (synthetic rows only). */
beforeEach(resetDatabase);

let seq = 0;
async function application(applicantId: string, status: "REJECTED" | "LICENSE_ISSUED") {
  seq++;
  return db.application.create({
    data: {
      referenceNo: `REBP-2026-NEW-${String(seq).padStart(6, "0")}-T`,
      type: "NEW",
      category: "REA",
      status,
      applicantId,
      submittedAt: new Date(),
      decidedAt: new Date(),
    },
  });
}

async function decide(
  applicationId: string,
  approverId: string,
  decision: string,
  reasonCodes: string[] = [],
) {
  seq++;
  return db.decision.create({
    data: {
      applicationId,
      approverId,
      decision,
      reasonCodes,
      letterNo: `TST-LTR-${seq}-${Date.now()}`,
      signedAt: new Date(),
      signature: {},
    },
  });
}

async function review(
  applicationId: string,
  officerId: string,
  version: number,
  recommendation: string,
  reasonCodes: string[] = [],
) {
  return db.review.create({
    data: { applicationId, officerId, version, recommendation, reasonCodes, signedAt: new Date() },
  });
}

describe("reasons report (FR-RPT-001)", () => {
  it("counts rejection reason codes and the latest signed recommendation per application", async () => {
    const applicant = await makeUser();
    const officer = await makeUser(["REVIEWING_OFFICER"]);
    const approver = await makeUser(["APPROVING_AUTHORITY"]);
    const a = await application(applicant.user.id, "REJECTED");
    const b = await application(applicant.user.id, "REJECTED");
    const c = await application(applicant.user.id, "LICENSE_ISSUED");
    await decide(a.id, approver.user.id, "REJECTED", ["INTEGRITY", "OTHER"]);
    await decide(b.id, approver.user.id, "REJECTED", ["INTEGRITY"]);
    await decide(c.id, approver.user.id, "APPROVED");
    // An amended review replaces the first one in the counts.
    await review(a.id, officer.user.id, 1, "APPROVE");
    await review(a.id, officer.user.id, 2, "REJECT", ["INTEGRITY"]);
    await review(b.id, officer.user.id, 1, "REJECT", ["INSUFFICIENT_EXPERIENCE"]);
    await review(c.id, officer.user.id, 1, "APPROVE");

    const report = await reasonsReport();
    expect(report.rejections).toBe(2);
    expect(report.rejectionReasons).toEqual([
      { key: "INTEGRITY", count: 2 },
      { key: "OTHER", count: 1 },
    ]);
    expect(report.recommendations).toEqual([
      { key: "REJECT", count: 2 },
      { key: "APPROVE", count: 1 },
    ]);
    expect(report.reviewReasons).toEqual([
      { key: "INSUFFICIENT_EXPERIENCE", count: 1 },
      { key: "INTEGRITY", count: 1 },
    ]);

    const csv = await applicationsByReasonCsv();
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "reference,type,category,status,decision,decisionReasons,recommendation,reviewReasons,decidedAt",
    );
    expect(lines).toHaveLength(4);
    expect(csv).toContain(
      `${a.referenceNo},NEW,REA,REJECTED,REJECTED,INTEGRITY;OTHER,REJECT,INTEGRITY,`,
    );
  });
});

describe("financial report (FR-RPT-003)", () => {
  it("splits collected revenue by fee type and month, with refunds and waivers", async () => {
    const applicant = await makeUser();
    const app = await application(applicant.user.id, "LICENSE_ISSUED");
    let n = 0;
    const pay = (data: {
      amount: number;
      status: "PAID" | "REFUNDED" | "WAIVED";
      lines: Array<{ code: string; amount: number }>;
      duplicate?: boolean;
    }) =>
      db.payment.create({
        data: {
          applicationId: app.id,
          reference: `PAY-T-${++n}-${Date.now()}`,
          feeVersion: 0,
          provider: "mock",
          payerId: applicant.user.id,
          paidAt: data.status === "PAID" ? new Date() : null,
          ...data,
        },
      });
    await pay({
      amount: 30_000,
      status: "PAID",
      lines: [
        { code: "registration", amount: 10_000 },
        { code: "licensing", amount: 20_000 },
      ],
    });
    await pay({
      amount: 25_000,
      status: "PAID",
      lines: [
        { code: "renewal", amount: 20_000 },
        { code: "latePenalty", amount: 5_000 },
      ],
    });
    // Duplicates are not revenue (FR-PAY-011).
    await pay({ amount: 30_000, status: "PAID", lines: [], duplicate: true });
    await pay({
      amount: 20_000,
      status: "REFUNDED",
      lines: [{ code: "licensing", amount: 20_000 }],
    });
    await pay({ amount: 15_000, status: "WAIVED", lines: [] });

    const report = await financialReport();
    expect(report.byFeeType).toEqual([
      { key: "registration", amount: 10_000 },
      { key: "licensing", amount: 40_000 },
      { key: "latePenalty", amount: 5_000 },
    ]);
    expect(report.byMonth).toHaveLength(12);
    expect(report.byMonth.at(-1)!.amount).toBe(55_000);
    expect(report.refunded).toEqual({ amount: 20_000, count: 1 });
    expect(report.waived).toEqual({ amount: 15_000, count: 1 });
    expect(report.collected).toBe(55_000);
  });
});
