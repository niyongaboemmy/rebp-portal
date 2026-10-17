import { describe, expect, it } from "vitest";
import {
  canTransition,
  categoryAvailability,
  formatLicenceNo,
  formatReference,
  formatRegistrationNo,
  isValidReference,
  luhnDigit,
  normaliseLicenceNo,
  stepsFor,
  type HeldLicenceSummary,
} from "../application";
import { APPLICATION_TYPES, CATEGORIES, type Category } from "../categories";
import { buildChecklist } from "../checklist";
import { calculateFees, DEFAULT_FEE_SCHEDULE } from "../fees";
import {
  checkSectionB,
  profileCompletion,
  checkSectionC,
  checkSectionD,
  checkSectionF,
  checkSectionG,
  checkSectionH,
  type SectionContext,
} from "../sections";

const ctx = (category: Category, over: Partial<SectionContext> = {}): SectionContext => ({
  type: "NEW",
  category,
  today: "2026-10-15",
  ...over,
});

describe("reference numbers (FR-A-001, FR-N-001)", () => {
  it("formats the SRS example shape", () => {
    expect(formatReference(2026, "NEW", 123)).toMatch(/^REBP-2026-NEW-000123-\d$/);
  });
  it.each(APPLICATION_TYPES)("round-trips %s", (type) => {
    expect(isValidReference(formatReference(2026, type, 42))).toBe(true);
  });
  it("detects a single-digit typo", () => {
    const ref = formatReference(2026, "NEW", 123);
    const tampered = ref.replace("000123", "000124");
    expect(isValidReference(tampered)).toBe(false);
  });
  it.each([
    ["79927398713".slice(0, -1), 3],
    ["0", 0],
  ])("luhn(%s) = %i", (digits, expected) => {
    expect(luhnDigit(digits)).toBe(expected);
  });
  it("formats registration and licence numbers", () => {
    expect(formatRegistrationNo("PERSON", 123)).toBe("RP-000123");
    expect(formatRegistrationNo("FIRM", 45)).toBe("RF-000045");
    expect(formatLicenceNo("FSLA", 2026, 42)).toBe("FSL-2026-00042");
  });
});

describe("type × category matrix (FR-DOM-001, SRS §3.3)", () => {
  const person = { applicantType: "INDIVIDUAL" as const, licences: [] as HeldLicenceSummary[] };
  const firm = { applicantType: "ORGANISATION" as const, licences: [] as HeldLicenceSummary[] };
  const held = (
    category: Category,
    status: HeldLicenceSummary["status"] = "ACTIVE",
    renewable = false,
  ) => ({
    applicantType: "INDIVIDUAL" as const,
    licences: [{ id: "l", category, status, expiresAt: new Date(), renewable }],
  });

  it.each<[Category, boolean]>([
    ["RERA", true],
    ["FSLA", true],
    ["REA", true],
    ["BROKER", true],
    ["ASSOCIATE_BROKER", false],
    ["MANAGING_BROKER", false],
    ["PRINCIPAL_BROKER", false],
    ["REBF", false],
  ])("NEW %s for a newcomer: %s", (category, ok) => {
    expect(categoryAvailability("NEW", category, person).ok).toBe(ok);
  });
  it("designations need a Broker licence and explain why", () => {
    expect(categoryAvailability("NEW", "PRINCIPAL_BROKER", person)).toEqual({
      ok: false,
      reason: "needsBrokerLicence",
    });
    expect(categoryAvailability("NEW", "PRINCIPAL_BROKER", held("BROKER")).ok).toBe(true);
  });
  it("firm registration is for organisations only and locks REBF", () => {
    expect(categoryAvailability("FIRM_REGISTRATION", "REBF", firm).ok).toBe(true);
    expect(categoryAvailability("FIRM_REGISTRATION", "REBF", person)).toEqual({
      ok: false,
      reason: "firmOnly",
    });
    expect(categoryAvailability("FIRM_REGISTRATION", "BROKER", firm).ok).toBe(false);
  });
  it("organisations cannot apply for individual categories", () => {
    expect(categoryAvailability("NEW", "FSLA", firm)).toEqual({
      ok: false,
      reason: "individualOnly",
    });
  });
  it("blocks a second active licence in the same category", () => {
    expect(categoryAvailability("NEW", "FSLA", held("FSLA"))).toEqual({
      ok: false,
      reason: "alreadyLicensed",
    });
  });
  it.each<[Category, Category, boolean]>([
    ["REA", "FSLA", true],
    ["BROKER", "REA", true],
    ["BROKER", "FSLA", false],
    ["ASSOCIATE_BROKER", "BROKER", true],
    ["FSLA", "RERA", false],
  ])("UPGRADE to %s holding %s: %s", (target, from, ok) => {
    expect(categoryAvailability("UPGRADE", target, held(from)).ok).toBe(ok);
  });
  it("renewal needs a renewable licence", () => {
    expect(categoryAvailability("RENEWAL", "FSLA", held("FSLA", "ACTIVE", true)).ok).toBe(true);
    expect(categoryAvailability("RENEWAL", "FSLA", held("FSLA", "ACTIVE", false))).toEqual({
      ok: false,
      reason: "needsLicence",
    });
  });
  it.each(["CHANGE_OF_AFFILIATION", "REINSTATEMENT"] as const)("%s is R2", (type) => {
    expect(categoryAvailability(type, "FSLA", held("FSLA"))).toEqual({
      ok: false,
      reason: "notInPilot",
    });
  });
});

describe("wizard steps (FR-WIZ-001/003, FR-G-000)", () => {
  it.each<[Category, string]>([
    ["RERA", "a b c f g h i review"],
    ["FSLA", "a b c d f g h i review"],
    ["REA", "a b c d e f g h i review"],
    ["BROKER", "a b c d e f g h i review"],
    ["ASSOCIATE_BROKER", "a b f g h i review"],
    ["MANAGING_BROKER", "a b f g h i review"],
    ["PRINCIPAL_BROKER", "a b g h i review"],
    ["REBF", "a g h i review"],
  ])("%s → %s", (category, steps) => {
    const type = category === "REBF" ? "FIRM_REGISTRATION" : "NEW";
    expect(stepsFor(type, category).join(" ")).toBe(steps);
  });
  it("renewal is a short flow", () => {
    expect(stepsFor("RENEWAL", "FSLA").join(" ")).toBe("a b f h i review");
  });
  it("every category has exactly one G-subsection except renewals", () => {
    for (const category of CATEGORIES)
      expect(stepsFor("NEW", category).filter((s) => s === "g")).toHaveLength(1);
  });
});

describe("state machine (FR-WF-001)", () => {
  it.each([
    ["DRAFT", "PENDING_PAYMENT", true],
    ["PENDING_PAYMENT", "PENDING_CONFIRMATIONS", true],
    ["PENDING_CONFIRMATIONS", "ACTION_REQUIRED", true],
    ["SUBMITTED", "UNDER_REVIEW", true],
    ["PENDING_DECISION", "APPROVED", true],
    ["APPROVED", "LICENSE_ISSUED", true],
    ["DRAFT", "APPROVED", false],
    ["REJECTED", "UNDER_REVIEW", false],
    ["LICENSE_ISSUED", "WITHDRAWN", false],
    ["UNDER_REVIEW", "LICENSE_ISSUED", false],
  ] as const)("%s → %s: %s", (from, to, ok) => {
    expect(canTransition(from, to)).toBe(ok);
  });
});

describe("section completeness (Appendix A)", () => {
  const goodB = {
    surname: "Uwase",
    givenNames: "Aline",
    idType: "NATIONAL_ID" as const,
    idNumber: "1199880012345678",
    dateOfBirth: "1998-04-02",
    nationality: ["RW"],
    phone: "0788123456",
    email: "aline@example.rw",
    residentialAddress: { province: "P1", district: "D1", sector: "S1" },
    professionalSameAsResidential: true,
    occupation: "Agent",
  };
  it("accepts a complete Section B", () => {
    expect(checkSectionB(goodB, ctx("FSLA"))).toEqual({});
  });
  it.each<[string, Record<string, unknown>, string, string]>([
    ["NID must be 16 digits", { idNumber: "123" }, "idNumber", "validation.nationalId"],
    ["names reject digits", { surname: "Uw4se" }, "surname", "validation.nameChars"],
    [
      "passport needs country",
      { idType: "PASSPORT", idNumber: "PC123456" },
      "idCountry",
      "validation.required",
    ],
    [
      "expired passport",
      { idType: "PASSPORT", idNumber: "PC123456", idCountry: "KE", idExpiry: "2026-01-01" },
      "idExpiry",
      "validation.documentExpired",
    ],
    ["future DOB", { dateOfBirth: "2030-01-01" }, "dateOfBirth", "validation.dateInFuture"],
    ["bad phone", { phone: "12" }, "phone", "validation.phoneInvalid"],
    [
      "professional address needed",
      { professionalSameAsResidential: false },
      "professionalAddress.province",
      "validation.required",
    ],
    [
      "abroad address free text",
      { residentialAddress: { abroad: true } },
      "residentialAddress.abroadText",
      "validation.required",
    ],
  ])("%s", (_l, patch, path, key) => {
    expect(checkSectionB({ ...goodB, ...patch }, ctx("FSLA"))[path]).toBe(key);
  });
  it("asks for gender only when the flag is on (FR-B-006)", () => {
    expect(checkSectionB(goodB, ctx("FSLA", { flags: { genderField: true } })).gender).toBe(
      "validation.required",
    );
  });
  it("needs a relied-upon qualification", () => {
    const issues = checkSectionC(
      {
        highestLevel: "A2",
        qualifications: [
          {
            id: "1",
            institution: "X",
            qualification: "Y",
            fieldOfStudy: "BUSINESS",
            yearCompleted: 2015,
            isForeign: false,
          },
        ],
      },
      ctx("FSLA"),
    );
    expect(issues.qualifications).toBe("validation.reliedUpon");
  });
  it("exam 'not applicable' only where no exam exists (FR-D-003)", () => {
    expect(
      checkSectionD({ trainingCompleted: false, examPassed: "NOT_APPLICABLE" }, ctx("REA"))
        .examPassed,
    ).toBe("validation.examRequired");
    expect(
      checkSectionD({ trainingCompleted: false, examPassed: "NOT_APPLICABLE" }, ctx("FSLA"))
        .examPassed,
    ).toBeUndefined();
  });
  it.each<[Category, Record<string, unknown>, string]>([
    ["FSLA", {}, "supervisorLicenceNo"],
    ["FSLA", { isAffiliated: true }, "firmName"],
    ["RERA", {}, "reraMode"],
    ["RERA", { reraMode: "REFERRAL" }, "referralApprovalRef"],
    ["BROKER", {}, "practiceArrangement"],
    ["BROKER", { practiceArrangement: "INDEPENDENT" }, "independentAuthorisationRef"],
    ["MANAGING_BROKER", {}, "branchId"],
    ["ASSOCIATE_BROKER", {}, "firmId"],
  ])("Section F %s %o requires %s", (category, f, field) => {
    expect(checkSectionF(f, ctx(category))[field]).toBeDefined();
  });
  it("asks whether the applicant already works with the firm only once a firm is named", () => {
    expect(checkSectionF({}, ctx("FSLA")).isAffiliated).toBeUndefined();
    expect(checkSectionF({ firmName: "Keza Realty" }, ctx("FSLA")).isAffiliated).toBe(
      "validation.required",
    );
  });
  it("rejects an affiliation start too far in the future (FR-F-005)", () => {
    expect(
      checkSectionF(
        {
          isAffiliated: true,
          firmName: "X",
          supervisorLicenceNo: "S",
          affiliationStart: "2027-01-01",
        },
        ctx("FSLA"),
      ).affiliationStart,
    ).toBe("validation.affiliationTooLate");
  });
  it.each<[Category, string]>([
    ["RERA", "article10Ack"],
    ["FSLA", "territory"],
    ["FSLA", "restrictionsAck"],
    ["REA", "dataConfirmed"],
    ["ASSOCIATE_BROKER", "supervisionAck"],
    ["MANAGING_BROKER", "supervisoryFunctions"],
    ["PRINCIPAL_BROKER", "responsibilities"],
    ["REBF", "responsiblePersons"],
    ["REBF", "hasSupervisoryManual"],
  ])("Section G for %s requires %s", (category, field) => {
    expect(checkSectionG({}, ctx(category))[field]).toBeDefined();
  });
  it("Section H requires disclosure details for a Yes (FR-H-002)", () => {
    const issues = checkSectionH(
      {
        criminalConviction: true,
        disciplinarySanction: false,
        licenceRevoked: false,
        currentRestriction: false,
        criminalRecordIssuedOn: "2026-09-01",
        codeOfConduct: true,
      },
      ctx("FSLA"),
    );
    expect(issues).toEqual({ disclosures: "validation.disclosureRequired" });
  });
});

describe("document checklist (Appendix B, FR-I-001)", () => {
  const types = (
    category: Category,
    data = {},
    type: "NEW" | "RENEWAL" | "FIRM_REGISTRATION" = "NEW",
  ) => buildChecklist({ type, category, data }).map((i) => i.type);
  it.each<[Category, string[]]>([
    [
      "RERA",
      ["proofOfIdentity", "photo", "educationCertificate", "criminalRecord", "affiliationEvidence"],
    ],
    [
      "FSLA",
      [
        "proofOfIdentity",
        "photo",
        "educationCertificate",
        "trainingCertificate",
        "criminalRecord",
        "affiliationEvidence",
      ],
    ],
    [
      "REA",
      [
        "proofOfIdentity",
        "photo",
        "educationCertificate",
        "trainingCertificate",
        "examResult",
        "experienceEvidence",
        "criminalRecord",
        "affiliationEvidence",
      ],
    ],
    [
      "MANAGING_BROKER",
      ["proofOfIdentity", "photo", "criminalRecord", "appointmentLetter", "managementTraining"],
    ],
    [
      "PRINCIPAL_BROKER",
      ["proofOfIdentity", "photo", "criminalRecord", "designationProof", "indemnityInsurance"],
    ],
  ])("%s", (category, expected) => {
    expect(types(category)).toEqual(expected);
  });
  it("adds recognition evidence for a foreign qualification", () => {
    expect(types("FSLA", { c: { qualifications: [{ id: "1", isForeign: true }] } })).toContain(
      "foreignRecognition",
    );
  });
  it("adds disclosure documents for a Yes in H", () => {
    expect(types("FSLA", { h: { licenceRevoked: true } })).toContain("integrityDisclosure");
  });
  it("RERA referral swaps affiliation evidence for the approval", () => {
    const list = types("RERA", { f: { reraMode: "REFERRAL" } });
    expect(list).toContain("referralApproval");
    expect(list).not.toContain("affiliationEvidence");
  });
  it("REBF has the corporate set and no personal ID", () => {
    const list = types("REBF", {}, "FIRM_REGISTRATION");
    expect(list).toEqual(
      expect.arrayContaining([
        "companyRegistration",
        "fullRegistrationInfo",
        "businessAddressProof",
        "supervisorySystems",
      ]),
    );
    expect(list).not.toContain("proofOfIdentity");
  });
  it("renewal asks only for what expires", () => {
    expect(types("FSLA", {}, "RENEWAL")).toEqual(["photo", "criminalRecord"]);
  });
});

describe("fees (FR-PAY-001, BR-040)", () => {
  it("itemises registration and licensing for a new application", () => {
    const quote = calculateFees(DEFAULT_FEE_SCHEDULE, { category: "FSLA", type: "NEW" });
    expect(quote.lines.map((l) => l.code)).toEqual(["registration", "licensing"]);
    expect(quote.total).toBe(45_000);
    expect(quote.sample).toBe(true);
  });
  it("adds the late penalty within the grace period", () => {
    const quote = calculateFees(DEFAULT_FEE_SCHEDULE, {
      category: "FSLA",
      type: "RENEWAL",
      late: true,
    });
    expect(quote.lines).toEqual([
      { code: "renewal", amount: 30_000 },
      { code: "latePenalty", amount: 7_500 },
    ]);
  });
  it("drops zero-amount lines", () => {
    const schedule = {
      ...DEFAULT_FEE_SCHEDULE,
      fees: { ...DEFAULT_FEE_SCHEDULE.fees, RERA: { registration: 0, licensing: 5 } },
    };
    expect(calculateFees(schedule, { category: "RERA", type: "NEW" }).lines).toHaveLength(1);
  });
});

describe("normaliseLicenceNo (UX-004 forgiving input)", () => {
  it.each([
    ["brk 2022 104", "BRK-2022-00104"],
    ["BRK/2022/00104", "BRK-2022-00104"],
    ["  rra-2025-115 ", "RRA-2025-00115"],
    ["BRK-2022-00104", "BRK-2022-00104"],
    ["not a licence", "NOT A LICENCE"],
  ])("%s → %s", (raw, expected) => {
    expect(normaliseLicenceNo(raw)).toBe(expected);
  });
});

describe("profileCompletion (UX-010)", () => {
  const ctx = { today: "2026-10-16" };
  const full = {
    surname: "Uwase",
    givenNames: "Aline",
    idType: "NATIONAL_ID" as const,
    idNumber: "1199880012345678",
    dateOfBirth: "1998-04-02",
    nationality: ["RW"],
    phone: "+250788123456",
    email: "aline@example.rw",
    residentialAddress: {
      province: "1",
      district: "11",
      sector: "1101",
      cell: "110101",
      village: "11010101",
    },
    professionalSameAsResidential: true,
    occupation: "Sales agent",
  };
  it("is empty for a new account", () => {
    const c = profileCompletion(undefined, ctx);
    expect(c.percent).toBe(0);
    expect(c.complete).toBe(false);
    expect(c.missing[0]).toBe("surname");
  });
  it("counts answers, with an address as one", () => {
    const c = profileCompletion({ surname: "Uwase", givenNames: "Aline" }, ctx);
    expect(c.done).toBe(2);
    expect(c.total).toBe(11);
  });
  it("adds passport details only for a passport", () => {
    expect(profileCompletion({ idType: "PASSPORT" }, ctx).total).toBe(13);
  });
  it("counts identity documents when given", () => {
    const c = profileCompletion(full, ctx, { proofOfIdentity: true, photo: false });
    expect(c.total).toBe(13);
    expect(c.missing).toEqual(["photo"]);
    expect(c.complete).toBe(false);
  });
  it("is complete when Section B would accept it", () => {
    const c = profileCompletion(full, ctx);
    expect(c.missing).toEqual([]);
    expect(c.percent).toBe(100);
    expect(checkSectionB(full, { ...ctx, type: "NEW", category: "RERA" })).toEqual({});
  });
});
