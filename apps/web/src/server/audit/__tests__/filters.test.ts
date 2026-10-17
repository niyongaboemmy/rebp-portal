import { describe, expect, it } from "vitest";
import {
  entityTerms,
  filterQuery,
  hasFilters,
  kigaliDayStart,
  occurredRange,
  parseAuditFilters,
} from "../filters";

describe("audit search filters (FR-AUD-004)", () => {
  it("keeps valid filters and drops malformed ones", () => {
    expect(
      parseAuditFilters({
        actor: "  Aline ",
        entity: "REBP-2026-000123",
        action: "config.",
        category: "twoStep",
        from: "2026-10-01",
        to: "2026-10-17",
      }),
    ).toEqual({
      actor: "Aline",
      entity: "REBP-2026-000123",
      action: "config.",
      category: "twoStep",
      from: "2026-10-01",
      to: "2026-10-17",
    });
    expect(
      parseAuditFilters({ actor: "   ", category: "nope", from: "2026-02-31", to: "17/10/2026" }),
    ).toEqual({});
  });

  it("reads URLSearchParams and arrays, and swaps a reversed range", () => {
    const params = new URLSearchParams("from=2026-10-17&to=2026-10-01&actor=x");
    expect(parseAuditFilters(params)).toEqual({ actor: "x", from: "2026-10-01", to: "2026-10-17" });
    expect(parseAuditFilters({ actor: ["first", "second"] })).toEqual({ actor: "first" });
  });

  it("caps free text", () => {
    expect(parseAuditFilters({ actor: "a".repeat(500) }).actor).toHaveLength(120);
  });

  it("maps Kigali days to a UTC instant range", () => {
    expect(kigaliDayStart("2026-10-17").toISOString()).toBe("2026-10-16T22:00:00.000Z");
    expect(occurredRange({ from: "2026-10-01", to: "2026-10-17" })).toEqual({
      gte: new Date("2026-09-30T22:00:00.000Z"),
      lt: new Date("2026-10-17T22:00:00.000Z"),
    });
    expect(occurredRange({})).toEqual({});
  });

  it("splits Type:id entity searches", () => {
    expect(entityTerms("Application:abc")).toEqual({ type: "Application", id: "abc" });
    expect(entityTerms("REBP-2026-1")).toEqual({ any: "REBP-2026-1" });
    expect(entityTerms(":abc")).toEqual({ any: ":abc" });
  });

  it("round-trips through the query string with extras", () => {
    const filters = { actor: "aline", category: "signin" as const, to: "2026-10-17" };
    const query = filterQuery(filters, { before: "120", format: undefined });
    expect(query).toBe("actor=aline&category=signin&to=2026-10-17&before=120");
    expect(parseAuditFilters(new URLSearchParams(query))).toEqual(filters);
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ action: "x" })).toBe(true);
  });
});
