import { describe, expect, it } from "vitest";
import type { Category } from "../categories";
import {
  addMonths,
  ageOn,
  computeExperience,
  DEFAULT_THRESHOLDS,
  evaluateEligibility,
  mergePeriods,
  overall,
  renewalTiming,
  subtractPeriods,
  type EligibilityFacts,
  type LicenceFact,
  type RuleInput,
  type RuleOutcome,
} from "../rules";
import type { ApplicationData } from "../sections";

const TODAY = "2026-10-15";
const facts = (over: Partial<EligibilityFacts> = {}): EligibilityFacts => ({
  today: TODAY,
  held: [],
  ...over,
});
const lic = (over: Partial<LicenceFact> = {}): LicenceFact => ({
  licenceNo: "BRK-2025-00001",
  category: "BROKER",
  status: "ACTIVE",
  issuedAt: "2025-01-01",
  expiresAt: "2027-06-01",
  ...over,
});

function run(input: Partial<RuleInput> & { data: ApplicationData; category: Category }) {
  return evaluateEligibility({ type: "NEW", facts: facts(), ...input });
}
const outcomeOf = (result: ReturnType<typeof run>, id: string) =>
  result.rules.find((x) => x.id === id)?.outcome;

/** SRS §10 BR catalogue, table-driven (Plan WP-2.1). */
describe("BR-001/002 minimum age", () => {
  const cases: Array<[string, string, RuleOutcome]> = [
    ["exactly 18 today", "2008-10-15", "PASS"],
    ["18 tomorrow", "2008-10-16", "FAIL"],
    ["17", "2009-05-01", "FAIL"],
    ["30", "1996-01-01", "PASS"],
    ["leap-day birthday, 18 on 28 Feb rule", "2008-02-29", "PASS"],
    ["70", "1956-03-03", "PASS"],
    ["born today", "2026-10-15", "FAIL"],
  ];
  const categories: Category[] = [
    "RERA",
    "FSLA",
    "REA",
    "BROKER",
    "ASSOCIATE_BROKER",
    "MANAGING_BROKER",
    "PRINCIPAL_BROKER",
  ];
  for (const category of categories) {
    it.each(cases)(`${category}: %s`, (_l, dob, expected) => {
      expect(outcomeOf(run({ category, data: { b: { dateOfBirth: dob } } }), "BR-001")).toBe(
        expected,
      );
    });
  }
  it("projects the 18th birthday as eligible-from (UAT under-age)", () => {
    const rule = run({ category: "FSLA", data: { b: { dateOfBirth: "2009-05-01" } } }).rules[0]!;
    expect(rule.eligibleFrom).toBe("2027-05-01");
  });
  it("does not apply to firms", () => {
    expect(
      outcomeOf(run({ category: "REBF", data: { b: { dateOfBirth: "2015-01-01" } } }), "BR-001"),
    ).toBeUndefined();
  });
  it("respects a configured threshold", () => {
    const result = run({
      category: "RERA",
      data: { b: { dateOfBirth: "2005-01-01" } },
      thresholds: { ...DEFAULT_THRESHOLDS, minAge: 25 },
    });
    expect(outcomeOf(result, "BR-001")).toBe("FAIL");
  });
});

describe("BR-010 RERA/FSLA education", () => {
  it.each<[string, RuleOutcome]>([
    ["A2", "PASS"],
    ["A1", "PASS"],
    ["A0", "PASS"],
    ["BACHELOR", "PASS"],
    ["POSTGRADUATE", "PASS"],
    ["OTHER_RECOGNISED", "NEEDS_ASSESSMENT"],
  ])("RERA %s → %s", (level, expected) => {
    expect(
      outcomeOf(run({ category: "RERA", data: { c: { highestLevel: level as never } } }), "BR-010"),
    ).toBe(expected);
  });
  it.each<[string, RuleOutcome]>([
    ["A2", "PASS"],
    ["OTHER_RECOGNISED", "NEEDS_ASSESSMENT"],
  ])("FSLA %s → %s", (level, expected) => {
    expect(
      outcomeOf(run({ category: "FSLA", data: { c: { highestLevel: level as never } } }), "BR-010"),
    ).toBe(expected);
  });
});

describe("BR-011/013 REA education", () => {
  const q = (fieldOfStudy: string) => [
    { id: "q1", reliedUpon: true, fieldOfStudy: fieldOfStudy as never },
  ];
  it.each<[string, string, string, RuleOutcome]>([
    ["bachelor any field", "BACHELOR", "LAW", "PASS"],
    ["postgraduate", "POSTGRADUATE", "OTHER", "PASS"],
    ["A1 business", "A1", "BUSINESS", "PASS"],
    ["A1 real estate", "A1", "REAL_ESTATE", "PASS"],
    ["A1 architecture", "A1", "ARCHITECTURE", "PASS"],
    ["A0 finance", "A0", "FINANCE", "PASS"],
    ["A1 general secondary", "A1", "GENERAL_SECONDARY", "FAIL"],
    ["A1 other field", "A1", "OTHER", "NEEDS_ASSESSMENT"],
    ["A2 only", "A2", "BUSINESS", "FAIL"],
    ["other recognised", "OTHER_RECOGNISED", "OTHER", "NEEDS_ASSESSMENT"],
  ])("%s", (_l, level, field, expected) => {
    const result = run({
      category: "REA",
      data: { c: { highestLevel: level as never, qualifications: q(field) } },
    });
    const rule = result.rules.find((x) => x.id === "BR-011" || x.id === "BR-013");
    expect(rule?.outcome).toBe(expected);
  });
});

describe("BR-014 Broker field of study", () => {
  it.each<[string, RuleOutcome]>([
    ["REAL_ESTATE", "PASS"],
    ["ESTATE_MANAGEMENT_VALUATION", "PASS"],
    ["VALUATION_PROPERTY_MANAGEMENT", "PASS"],
    ["OTHER", "NEEDS_ASSESSMENT"],
    ["BUSINESS", "FAIL"],
    ["LAW", "FAIL"],
    ["CIVIL_ENGINEERING", "FAIL"],
  ])("%s → %s", (field, expected) => {
    const result = run({
      category: "BROKER",
      data: {
        c: {
          highestLevel: "BACHELOR",
          qualifications: [{ id: "1", reliedUpon: true, fieldOfStudy: field as never }],
        },
      },
    });
    expect(outcomeOf(result, "BR-014")).toBe(expected);
  });
  it("ignores qualifications not relied upon", () => {
    const result = run({
      category: "BROKER",
      data: {
        c: { qualifications: [{ id: "1", reliedUpon: false, fieldOfStudy: "REAL_ESTATE" }] },
      },
    });
    expect(outcomeOf(result, "BR-014")).toBeUndefined();
  });
});

describe("BR-012 foreign qualification", () => {
  it.each<[Category, boolean, RuleOutcome | undefined]>([
    ["RERA", true, "WARN"],
    ["FSLA", true, "WARN"],
    ["REA", true, "WARN"],
    ["BROKER", true, "WARN"],
    ["REA", false, undefined],
    ["ASSOCIATE_BROKER", true, undefined],
  ])("%s foreign=%s", (category, isForeign, expected) => {
    const result = run({
      category,
      data: {
        c: {
          highestLevel: "BACHELOR",
          qualifications: [{ id: "1", reliedUpon: true, isForeign, fieldOfStudy: "REAL_ESTATE" }],
        },
      },
    });
    expect(outcomeOf(result, "BR-012")).toBe(expected);
  });
});

describe("BR-015 training", () => {
  it.each<[Category, boolean, string | undefined, RuleOutcome | undefined]>([
    ["FSLA", true, "ENTRY", "PASS"],
    ["FSLA", true, "PROFESSIONAL", "FAIL"],
    ["FSLA", false, undefined, "FAIL"],
    ["REA", true, "PROFESSIONAL", "PASS"],
    ["REA", true, "ENTRY", "FAIL"],
    ["REA", false, undefined, "FAIL"],
    ["BROKER", true, "ADVANCED_BROKER", "PASS"],
    ["BROKER", true, "MANAGEMENT", "FAIL"],
    ["BROKER", false, undefined, "FAIL"],
    ["RERA", false, undefined, undefined],
    ["ASSOCIATE_BROKER", false, undefined, undefined],
  ])("%s completed=%s programme=%s", (category, completed, programme, expected) => {
    const result = run({
      category,
      data: { d: { trainingCompleted: completed, trainingProgramme: programme as never } },
    });
    expect(outcomeOf(result, "BR-015")).toBe(expected);
  });
});

describe("BR-016 licensing exam", () => {
  it.each<[Category, string, string | undefined, RuleOutcome | undefined]>([
    ["REA", "YES", "2025-01-01", "PASS"],
    ["REA", "YES", "2023-10-15", "PASS"],
    ["REA", "YES", "2023-10-14", "FAIL"],
    ["REA", "NO", undefined, "FAIL"],
    ["BROKER", "YES", "2024-06-01", "PASS"],
    ["BROKER", "YES", "2020-01-01", "FAIL"],
    ["BROKER", "NOT_APPLICABLE", undefined, "FAIL"],
    ["FSLA", "NOT_APPLICABLE", undefined, undefined],
    ["RERA", "NO", undefined, undefined],
  ])("%s %s %s", (category, answer, examDate, expected) => {
    const result = run({ category, data: { d: { examPassed: answer as never, examDate } } });
    expect(outcomeOf(result, "BR-016")).toBe(expected);
  });
});

describe("BR-020/021 experience (+ BR-022/023)", () => {
  const rec = (category: string, from: string, to?: string, current = false) => ({
    id: `${from}-${to}`,
    category: category as never,
    from,
    to,
    current,
    firm: "Firm",
    duties: "Sales",
  });
  it.each<[string, Category, ReturnType<typeof rec>[], RuleOutcome]>([
    ["REA exactly 3y FSLA", "REA", [rec("FSLA", "2023-10-15", "2026-10-15")], "PASS"],
    ["REA 2y5m FSLA ongoing (UAT-03)", "REA", [rec("FSLA", "2024-05-15", undefined, true)], "FAIL"],
    ["REA 4y FSLA", "REA", [rec("FSLA", "2022-01-01", "2026-01-01")], "PASS"],
    [
      "REA RERA does not count by default",
      "REA",
      [rec("RERA", "2020-01-01", "2026-01-01")],
      "FAIL",
    ],
    [
      "REA overlapping periods merged",
      "REA",
      [rec("FSLA", "2024-01-01", "2025-12-31"), rec("FSLA", "2025-01-01", "2026-06-30")],
      "FAIL",
    ],
    [
      "REA two periods add up",
      "REA",
      [rec("FSLA", "2020-01-01", "2021-12-31"), rec("FSLA", "2023-01-01", "2024-12-31")],
      "PASS",
    ],
    ["Broker needs REA not FSLA", "BROKER", [rec("FSLA", "2015-01-01", "2025-01-01")], "FAIL"],
    ["Broker 3y REA", "BROKER", [rec("REA", "2022-01-01", "2025-06-01")], "PASS"],
    ["Broker 1y REA", "BROKER", [rec("REA", "2025-06-01", "2026-06-01")], "FAIL"],
  ])("%s", (_l, category, records, expected) => {
    const id = category === "REA" ? "BR-020" : "BR-021";
    expect(outcomeOf(run({ category, data: { e: { records } } }), id)).toBe(expected);
  });

  it("projects eligible-from for an ongoing period (FR-ELG-004)", () => {
    const result = run({
      category: "REA",
      data: { e: { records: [rec("FSLA", "2024-05-15", undefined, true)] } },
    });
    const rule = result.rules.find((x) => x.id === "BR-020")!;
    expect(rule.message).toBe("BR-020.notYet");
    expect(rule.values?.years).toBe(2);
    expect(rule.values?.months).toBe(5);
    expect(rule.eligibleFrom).toBe("2027-05-15");
  });

  it("gives no eligible-from date when the period has ended", () => {
    const result = run({
      category: "REA",
      data: { e: { records: [rec("FSLA", "2020-01-01", "2021-01-01")] } },
    });
    expect(result.rules.find((x) => x.id === "BR-020")?.eligibleFrom).toBeUndefined();
  });

  it("routes claimed equivalence to assessment", () => {
    const result = run({
      category: "REA",
      data: { e: { records: [], equivalentRecognised: true } },
    });
    expect(outcomeOf(result, "BR-020")).toBe("NEEDS_ASSESSMENT");
  });

  it("counts RERA towards REA when configured (Q-03)", () => {
    const result = run({
      category: "REA",
      data: { e: { records: [rec("RERA", "2020-01-01", "2026-01-01")] } },
      thresholds: { ...DEFAULT_THRESHOLDS, reraCountsForRea: true },
    });
    expect(outcomeOf(result, "BR-020")).toBe("PASS");
  });

  it("prefers register history and excludes suspensions (BR-022)", () => {
    const held = [
      lic({
        category: "REA",
        issuedAt: "2023-01-01",
        expiresAt: "2027-01-01",
        suspensions: [{ from: "2024-01-01", to: "2024-12-31" }],
      }),
    ];
    const result = run({
      category: "BROKER",
      data: { e: { records: [] } },
      facts: facts({ held }),
    });
    expect(outcomeOf(result, "BR-021")).toBe("FAIL");
    expect(outcomeOf(result, "BR-022")).toBe("WARN");
    expect(result.experience?.excluded).toHaveLength(1);
  });

  it("respects a changed threshold (FR-ELG-002)", () => {
    const result = run({
      category: "REA",
      data: { e: { records: [rec("FSLA", "2024-05-15", undefined, true)] } },
      thresholds: { ...DEFAULT_THRESHOLDS, reaExperienceMonths: 24 },
    });
    expect(outcomeOf(result, "BR-020")).toBe("PASS");
  });
});

describe("experience helpers", () => {
  it("merges touching and overlapping periods", () => {
    expect(
      mergePeriods([
        { from: "2020-01-01", to: "2020-06-30" },
        { from: "2020-07-01", to: "2020-12-31" },
        { from: "2020-03-01", to: "2020-04-01" },
        { from: "2022-01-01", to: "2022-01-31" },
      ]),
    ).toEqual([
      { from: "2020-01-01", to: "2020-12-31" },
      { from: "2022-01-01", to: "2022-01-31" },
    ]);
  });
  it("drops inverted periods", () => {
    expect(mergePeriods([{ from: "2021-01-01", to: "2020-01-01" }])).toEqual([]);
  });
  it.each([
    [
      { from: "2020-03-01", to: "2020-03-31" },
      [
        { from: "2020-01-01", to: "2020-02-29" },
        { from: "2020-04-01", to: "2020-12-31" },
      ],
    ],
    [{ from: "2019-01-01", to: "2020-06-30" }, [{ from: "2020-07-01", to: "2020-12-31" }]],
    [{ from: "2021-01-01", to: "2021-02-01" }, [{ from: "2020-01-01", to: "2020-12-31" }]],
    [{ from: "2019-01-01", to: "2022-01-01" }, []],
  ])("subtracts %o", (hole, expected) => {
    expect(subtractPeriods([{ from: "2020-01-01", to: "2020-12-31" }], [hole])).toEqual(expected);
  });
  it("computes summary days for a single year", () => {
    const summary = computeExperience(
      { e: { records: [{ id: "1", category: "FSLA", from: "2025-01-01", to: "2025-12-31" }] } },
      facts(),
      ["FSLA"],
      36,
    );
    expect(summary.days).toBe(365);
    expect(summary.months).toBe(11);
  });
  it.each([
    ["2026-01-31", 1, "2026-02-28"],
    ["2024-01-31", 1, "2024-02-29"],
    ["2026-03-15", 12, "2027-03-15"],
    ["2026-12-01", 2, "2027-02-01"],
  ])("addMonths(%s, %i) = %s", (day, n, expected) => {
    expect(addMonths(day, n)).toBe(expected);
  });
  it.each([
    ["2000-10-15", "2026-10-15", 26],
    ["2000-10-16", "2026-10-15", 25],
    ["2000-02-29", "2026-02-28", 25],
  ])("ageOn(%s, %s) = %i", (birth, on, age) => {
    expect(ageOn(birth, on)).toBe(age);
  });
});

describe("BR-030 supervisor validity", () => {
  const sup = (over: Partial<LicenceFact>) => lic({ licenceNo: "S-1", ...over });
  it.each<[Category, LicenceFact | null, RuleOutcome, string]>([
    ["FSLA", sup({ category: "REA" }), "PASS", "pass"],
    ["FSLA", sup({ category: "BROKER" }), "PASS", "pass"],
    ["FSLA", sup({ category: "FSLA" }), "FAIL", "category"],
    ["FSLA", sup({ category: "REA", status: "SUSPENDED" }), "FAIL", "inactive"],
    ["FSLA", sup({ category: "REA", status: "EXPIRED" }), "FAIL", "inactive"],
    ["FSLA", null, "FAIL", "notFound"],
    ["REA", sup({ category: "BROKER" }), "PASS", "pass"],
    ["REA", sup({ category: "REA" }), "FAIL", "category"],
    ["REA", sup({ category: "PRINCIPAL_BROKER" }), "PASS", "pass"],
    ["RERA", sup({ category: "BROKER" }), "PASS", "pass"],
    ["RERA", sup({ category: "FSLA" }), "FAIL", "category"],
    ["RERA", sup({ category: "BROKER", status: "REVOKED" }), "FAIL", "inactive"],
    ["FSLA", sup({ category: "REA", holderIsApplicant: true }), "FAIL", "self"],
  ])("%s supervised by %o", (category, supervisor, expected, suffix) => {
    const result = run({
      category,
      data: { f: { supervisorLicenceNo: "S-1" } },
      facts: facts({ supervisor }),
    });
    const rule = result.rules.find((x) => x.id === "BR-030")!;
    expect(rule.outcome).toBe(expected);
    expect(rule.message).toBe(`BR-030.${suffix}`);
  });
  it("does not apply to Brokers", () => {
    const result = run({
      category: "BROKER",
      data: { f: { supervisorLicenceNo: "S-1" } },
      facts: facts({ supervisor: null }),
    });
    expect(outcomeOf(result, "BR-030")).toBeUndefined();
  });
});

describe("BR-031 Broker licence for designations", () => {
  const categories: Category[] = ["ASSOCIATE_BROKER", "MANAGING_BROKER", "PRINCIPAL_BROKER"];
  for (const category of categories) {
    it.each<[string, LicenceFact[], RuleOutcome]>([
      ["active broker", [lic()], "PASS"],
      ["expiring broker", [lic({ expiresAt: "2026-11-01" })], "WARN"],
      ["suspended broker", [lic({ status: "SUSPENDED" })], "FAIL"],
      ["REA only", [lic({ category: "REA" })], "FAIL"],
      ["nothing", [], "FAIL"],
    ])(`${category}: %s`, (_l, held, expected) => {
      expect(outcomeOf(run({ category, data: {}, facts: facts({ held }) }), "BR-031")).toBe(
        expected,
      );
    });
  }
});

describe("BR-032 REBF principal broker", () => {
  it.each<[string, Partial<EligibilityFacts>, RuleOutcome]>([
    ["active PB", { principal: lic({ category: "PRINCIPAL_BROKER" }) }, "PASS"],
    [
      "suspended PB",
      { principal: lic({ category: "PRINCIPAL_BROKER", status: "SUSPENDED" }) },
      "FAIL",
    ],
    ["broker only", { principal: lic({ category: "BROKER" }) }, "FAIL"],
    [
      "linked PB application pending",
      { principal: lic({ category: "BROKER" }), principalPending: true },
      "WARN",
    ],
    ["unknown", { principal: null }, "FAIL"],
  ])("%s", (_l, extra, expected) => {
    const result = run({
      category: "REBF",
      type: "FIRM_REGISTRATION",
      data: { g: { principalBrokerLicenceNo: "P" } },
      facts: facts(extra),
    });
    expect(outcomeOf(result, "BR-032")).toBe(expected);
  });
});

describe("BR-033 one managing broker per branch", () => {
  it.each<[boolean, RuleOutcome]>([
    [true, "FAIL"],
    [false, "PASS"],
  ])("taken=%s", (taken, expected) => {
    const result = run({
      category: "MANAGING_BROKER",
      data: {},
      facts: facts({ branchHasManagingBroker: taken }),
    });
    expect(outcomeOf(result, "BR-033")).toBe(expected);
  });
});

describe("BR-035/036 affiliation and independent practice", () => {
  it.each<[string, Category, ApplicationData["f"], Partial<EligibilityFacts>, RuleOutcome]>([
    [
      "registered active firm",
      "FSLA",
      { firmId: "00000000-0000-4000-8000-000000000001" },
      { firm: { found: true, status: "ACTIVE", hasPrincipal: true } },
      "PASS",
    ],
    ["manual firm", "FSLA", { firmName: "New Co" }, { firm: null }, "NEEDS_ASSESSMENT"],
    [
      "suspended firm",
      "REA",
      { firmId: "00000000-0000-4000-8000-000000000001" },
      { firm: { found: true, status: "SUSPENDED", hasPrincipal: true } },
      "FAIL",
    ],
    [
      "RERA referral arrangement",
      "RERA",
      { reraMode: "REFERRAL", referralApprovalRef: "RA-1" },
      {},
      "NEEDS_ASSESSMENT",
    ],
  ])("%s", (_l, category, f, extra, expected) => {
    expect(outcomeOf(run({ category, data: { f }, facts: facts(extra) }), "BR-035")).toBe(expected);
  });
  it.each<[string | undefined, RuleOutcome]>([
    ["AUTH-9", "NEEDS_ASSESSMENT"],
    [undefined, "FAIL"],
  ])("independent broker ref=%s (UAT-04)", (ref, expected) => {
    const result = run({
      category: "BROKER",
      data: { f: { practiceArrangement: "INDEPENDENT", independentAuthorisationRef: ref } },
    });
    expect(outcomeOf(result, "BR-036")).toBe(expected);
  });
});

describe("BR-060/061/062 integrity", () => {
  it.each([
    "criminalConviction",
    "disciplinarySanction",
    "licenceRevoked",
    "currentRestriction",
  ] as const)("%s = yes routes to assessment, never rejection (UAT-06)", (question) => {
    const result = run({ category: "FSLA", data: { h: { [question]: true } } });
    expect(outcomeOf(result, "BR-060")).toBe("NEEDS_ASSESSMENT");
    expect(result.outcome).toBe("NEEDS_ASSESSMENT");
  });
  it.each<[string, RuleOutcome]>([
    ["2026-10-01", "PASS"],
    ["2026-04-15", "PASS"],
    ["2026-04-14", "FAIL"],
    ["2025-01-01", "FAIL"],
  ])("criminal record issued %s", (issued, expected) => {
    expect(
      outcomeOf(
        run({ category: "REA", data: { h: { criminalRecordIssuedOn: issued } } }),
        "BR-061",
      ),
    ).toBe(expected);
  });
  it.each<[boolean, RuleOutcome | undefined]>([
    [false, "FAIL"],
    [true, undefined],
  ])("code of conduct %s", (answer, expected) => {
    expect(
      outcomeOf(run({ category: "RERA", data: { h: { codeOfConduct: answer } } }), "BR-062"),
    ).toBe(expected);
  });
});

describe("BR-070 indemnity insurance", () => {
  it.each<[Category, string, RuleOutcome]>([
    ["PRINCIPAL_BROKER", "2027-01-01", "PASS"],
    ["PRINCIPAL_BROKER", "2026-10-15", "FAIL"],
    ["REBF", "2028-01-01", "PASS"],
    ["REBF", "2025-01-01", "FAIL"],
  ])("%s until %s", (category, to, expected) => {
    expect(outcomeOf(run({ category, data: { g: { indemnity: { to } } } }), "BR-070")).toBe(
      expected,
    );
  });
});

describe("BR-040 renewal and BR-100 upgrade", () => {
  it.each<[string, LicenceFact | null, RuleOutcome]>([
    ["active", lic({ category: "FSLA", status: "ACTIVE", expiresAt: "2026-12-01" }), "PASS"],
    [
      "expired 10 days ago (grace)",
      lic({ category: "FSLA", status: "EXPIRED", expiresAt: "2026-10-05" }),
      "WARN",
    ],
    [
      "expired 31 days ago",
      lic({ category: "FSLA", status: "EXPIRED", expiresAt: "2026-09-14" }),
      "FAIL",
    ],
    ["lapsed", lic({ category: "FSLA", status: "LAPSED", expiresAt: "2026-01-01" }), "FAIL"],
    ["none", null, "FAIL"],
  ])("renewal: %s", (_l, relatedLicence, expected) => {
    const result = run({
      category: "FSLA",
      type: "RENEWAL",
      data: {},
      facts: facts({ relatedLicence }),
    });
    expect(outcomeOf(result, "BR-040")).toBe(expected);
  });
  it("renewal skips first-time rules", () => {
    const result = run({
      category: "REA",
      type: "RENEWAL",
      data: { b: { dateOfBirth: "2015-01-01" }, d: { examPassed: "NO" } },
      facts: facts({ relatedLicence: lic({ category: "REA" }) }),
    });
    expect(result.rules.map((x) => x.id)).toEqual(["BR-040"]);
  });
  it.each<[LicenceFact | null, RuleOutcome]>([
    [lic({ category: "FSLA" }), "PASS"],
    [lic({ category: "FSLA", status: "SUSPENDED" }), "FAIL"],
    [null, "FAIL"],
  ])("upgrade from %o", (relatedLicence, expected) => {
    const result = run({
      category: "REA",
      type: "UPGRADE",
      data: {},
      facts: facts({ relatedLicence }),
    });
    expect(outcomeOf(result, "BR-100")).toBe(expected);
  });
  it.each<[string, string, string, string]>([
    ["ACTIVE", "2027-06-01", TODAY, "notYet"],
    ["ACTIVE", "2027-01-13", TODAY, "open"],
    ["ACTIVE", "2026-11-01", TODAY, "open"],
    ["EXPIRED", "2026-10-01", TODAY, "late"],
    ["EXPIRED", "2026-09-01", TODAY, "closed"],
    ["LAPSED", "2026-01-01", TODAY, "closed"],
    ["SUSPENDED", "2027-01-01", TODAY, "closed"],
  ])("renewalTiming(%s, %s)", (status, expires, today, expected) => {
    expect(renewalTiming(status as never, expires, today)).toBe(expected);
  });
});

describe("overall outcome", () => {
  it.each<[RuleOutcome[], RuleOutcome]>([
    [[], "PASS"],
    [["PASS", "PASS"], "PASS"],
    [["PASS", "WARN"], "WARN"],
    [["WARN", "NEEDS_ASSESSMENT"], "NEEDS_ASSESSMENT"],
    [["NEEDS_ASSESSMENT", "FAIL"], "FAIL"],
  ])("%o → %s", (outcomes, expected) => {
    expect(overall(outcomes.map((outcome, i) => ({ id: `R${i}`, outcome, message: "x" })))).toBe(
      expected,
    );
  });
});

/** UX-004 §3.1: every problem comes with how to fix it and where. */
describe("rule guidance", () => {
  const sup = (over: Partial<LicenceFact>) => lic({ licenceNo: "S-1", ...over });

  it("names the held and allowed categories when a supervisor can't supervise", () => {
    const result = run({
      category: "RERA",
      data: { f: { supervisorLicenceNo: "S-1" } },
      facts: facts({ supervisor: sup({ category: "FSLA" }) }),
    });
    const rule = result.rules.find((x) => x.id === "BR-030")!;
    expect(rule).toMatchObject({
      fix: "BR-030.categoryFix",
      action: { kind: "goToField" },
      field: "f.supervisorLicenceNo",
      values: {
        held: "FSLA",
        allowed: "BROKER,ASSOCIATE_BROKER,MANAGING_BROKER,PRINCIPAL_BROKER,REA",
      },
    });
  });

  it("gives the date a new criminal record certificate must be issued after", () => {
    const result = run({ category: "REA", data: { h: { criminalRecordIssuedOn: "2025-01-10" } } });
    const rule = result.rules.find((x) => x.id === "BR-061")!;
    expect(rule.outcome).toBe("FAIL");
    expect(rule.action).toEqual({ kind: "replaceDocument", documentType: "criminalRecord" });
    expect(rule.values).toMatchObject({ issued: "2025-01-10", cutoff: addMonths(TODAY, -6) });
  });

  it("sends a missing exam to the exam question, not the exam date", () => {
    const result = run({ category: "REA", data: { d: { examPassed: "NO" } } });
    expect(result.rules.find((x) => x.id === "BR-016")?.field).toBe("d.examPassed");
  });

  it("marks officer-only results as having nothing to do", () => {
    const result = run({
      category: "RERA",
      data: { f: { reraMode: "REFERRAL", referralApprovalRef: "PB-1" } },
    });
    const rule = result.rules.find((x) => x.id === "BR-035")!;
    expect(rule.outcome).toBe("NEEDS_ASSESSMENT");
    expect(rule.action).toEqual({ kind: "none" });
    expect(rule.fix).toBeUndefined();
  });

  it("guides every FAIL and WARN and never a PASS", () => {
    const samples = [
      run({
        category: "RERA",
        data: { b: { dateOfBirth: "2015-01-01" }, c: { highestLevel: "NONE" as never } },
      }),
      run({ category: "REA", data: { d: { trainingCompleted: false, examPassed: "NO" } } }),
      run({
        category: "MANAGING_BROKER",
        data: { f: {} },
        facts: facts({ branchHasManagingBroker: true }),
      }),
      run({ category: "BROKER", data: { f: { practiceArrangement: "INDEPENDENT" } } }),
      run({
        category: "REA",
        data: { h: { codeOfConduct: false, criminalRecordIssuedOn: "2020-01-01" } },
      }),
      run({ category: "PRINCIPAL_BROKER", data: { g: { indemnity: { to: "2020-01-01" } } } }),
      run({ category: "REA", type: "RENEWAL", data: {}, facts: facts({ relatedLicence: null }) }),
    ];
    const rules = samples.flatMap((s) => s.rules);
    expect(rules.some((x) => x.outcome === "FAIL")).toBe(true);
    for (const rule of rules) {
      if (rule.outcome === "FAIL" || rule.outcome === "WARN") {
        expect(rule.fix, rule.message).toBe(`${rule.message}Fix`);
        expect(rule.action, rule.message).toBeDefined();
      } else if (rule.outcome === "PASS") {
        expect(rule.fix).toBeUndefined();
        expect(rule.action).toBeUndefined();
      }
    }
  });
});
