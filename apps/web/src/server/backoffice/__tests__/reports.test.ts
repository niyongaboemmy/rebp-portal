import { describe, expect, it } from "vitest";
import { countCodes, feeGroupOf, kigaliMonth, lastMonths, revenueBreakdown } from "../reports";

describe("rejection reasons (FR-RPT-001)", () => {
  it("counts each code once per row, most frequent first", () => {
    expect(
      countCodes([
        { codes: ["INTEGRITY", "OTHER"] },
        { codes: ["INTEGRITY", "INTEGRITY"] },
        { codes: [] },
        { codes: ["INSUFFICIENT_EXPERIENCE"] },
      ]),
    ).toEqual([
      { key: "INTEGRITY", count: 2 },
      { key: "INSUFFICIENT_EXPERIENCE", count: 1 },
      { key: "OTHER", count: 1 },
    ]);
  });
});

describe("revenue breakdown (FR-RPT-003)", () => {
  const months = lastMonths(3, new Date("2026-10-17T10:00:00Z"));

  it("lists Kigali months oldest first, across a year boundary", () => {
    expect(months).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(lastMonths(3, new Date("2026-01-05T00:00:00Z"))).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
    ]);
    // 22:30 UTC on 31 Oct is already 1 Nov in Kigali.
    expect(kigaliMonth(new Date("2026-10-31T22:30:00Z"))).toBe("2026-11");
  });

  it("maps fee line codes to groups", () => {
    expect(feeGroupOf("registration")).toBe("registration");
    expect(feeGroupOf("renewal")).toBe("licensing");
    expect(feeGroupOf("licensing")).toBe("licensing");
    expect(feeGroupOf("latePenalty")).toBe("latePenalty");
    expect(feeGroupOf(undefined)).toBe("other");
  });

  it("splits by fee type and month, and always adds up to the amount collected", () => {
    const at = (iso: string) => new Date(iso);
    const result = revenueBreakdown(
      [
        {
          amount: 30_000,
          lines: [
            { code: "registration", amount: 10_000 },
            { code: "licensing", amount: 20_000 },
          ],
          paidAt: at("2026-10-02T09:00:00Z"),
          createdAt: at("2026-10-01T09:00:00Z"),
        },
        {
          amount: 25_000,
          lines: [
            { code: "renewal", amount: 20_000 },
            { code: "latePenalty", amount: 5_000 },
          ],
          paidAt: at("2026-09-10T09:00:00Z"),
          createdAt: at("2026-09-10T09:00:00Z"),
        },
        // Legacy row without lines; paid long ago (outside the window).
        {
          amount: 7_000,
          lines: null,
          paidAt: at("2025-01-01T09:00:00Z"),
          createdAt: at("2025-01-01"),
        },
        // No paidAt: falls back to createdAt.
        {
          amount: 1_000,
          lines: [{ code: "registration", amount: 1_000 }],
          paidAt: null,
          createdAt: at("2026-08-20T09:00:00Z"),
        },
      ],
      months,
    );
    expect(result.byFeeType).toEqual([
      { key: "registration", amount: 11_000 },
      { key: "licensing", amount: 40_000 },
      { key: "latePenalty", amount: 5_000 },
      { key: "other", amount: 7_000 },
    ]);
    expect(result.byFeeType.reduce((s, g) => s + g.amount, 0)).toBe(63_000);
    expect(result.byMonth).toEqual([
      { month: "2026-08", amount: 1_000 },
      { month: "2026-09", amount: 25_000 },
      { month: "2026-10", amount: 30_000 },
    ]);
  });

  it("omits the 'other' group when everything is itemised", () => {
    const { byFeeType } = revenueBreakdown([], months);
    expect(byFeeType.map((g) => g.key)).toEqual(["registration", "licensing", "latePenalty"]);
  });
});
