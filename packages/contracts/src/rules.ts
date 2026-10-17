import type { ApplicationType, Category } from "./categories";
import type { DocumentType } from "./checklist";
import type { LicenseStatus } from "./status";
import { SUPERVISOR_CATEGORIES } from "./application";
import {
  EXAM_CATEGORIES,
  INTEGRITY_QUESTIONS,
  REQUIRED_TRAINING,
  type ApplicationData,
  type EducationLevelC,
  type FieldOfStudy,
} from "./sections";

/**
 * Eligibility engine (SRS §9.1 FR-ELG-001…004, §10 business rules). Pure and deterministic:
 * the same input gives the same result in the wizard (live, FR-WIZ-007), at submission
 * (blocking, FR-WIZ-013) and at review (shown to the officer, FR-L-006). Register facts
 * (supervisor licence, held licences, suspensions) are supplied by the server.
 *
 * Thresholds are configuration (FR-ELG-002): administrators change them through maker-checker,
 * and each run stores the version it used.
 */

export type RuleOutcome = "PASS" | "FAIL" | "WARN" | "NEEDS_ASSESSMENT";
export type RunContext = "LIVE" | "SUBMIT" | "REVIEW";

export interface RuleThresholds {
  minAge: number;
  reaExperienceMonths: number;
  brokerExperienceMonths: number;
  examValidityYears: number;
  criminalRecordMonths: number;
  renewalWindowDays: number;
  graceDays: number;
  licenceValidityYears: number;
  brokerExpiryWarningDays: number;
  /** Whether self-declared FSLA experience counts for REA; RERA never does unless configured (Q-03). */
  reraCountsForRea: boolean;
}

export const DEFAULT_THRESHOLDS: RuleThresholds = {
  minAge: 18,
  reaExperienceMonths: 36,
  brokerExperienceMonths: 36,
  examValidityYears: 3,
  criminalRecordMonths: 6,
  renewalWindowDays: 90,
  graceDays: 30,
  licenceValidityYears: 1,
  brokerExpiryWarningDays: 60,
  reraCountsForRea: false,
};

export interface LicenceFact {
  licenceNo: string;
  category: Category;
  status: LicenseStatus;
  issuedAt: string;
  expiresAt: string;
  holderIsApplicant?: boolean;
  /** Suspension periods (BR-022). */
  suspensions?: ReadonlyArray<{ from: string; to: string | null }>;
}

export interface EligibilityFacts {
  /** YYYY-MM-DD in Africa/Kigali. */
  today: string;
  /** Licences held by the applicant (register beats self-declared data, FR-E-007). */
  held: readonly LicenceFact[];
  /** The supervisor named in Section F, looked up in the register (BR-030). */
  supervisor?: LicenceFact | null;
  /** The firm named in Section F or G (BR-035). */
  firm?: { found: boolean; status: string; hasPrincipal: boolean } | null;
  /** REBF: the proposed Principal Broker's licence (BR-032). */
  principal?: LicenceFact | null;
  /** REBF: a linked Principal Broker application is pending (FR-FIRM-011). */
  principalPending?: boolean;
  /** Managing Broker: the chosen branch already has one (BR-033). */
  branchHasManagingBroker?: boolean;
  /** Renewal and upgrade: the licence concerned. */
  relatedLicence?: LicenceFact | null;
}

/**
 * What the applicant can do about a rule (UX-004 §3.1): the wizard renders it as one button, so
 * every problem comes with a way to fix it, not only a description of it.
 */
export type RuleAction =
  /** Focus the answer the rule is about (`field` on the result). */
  | { kind: "goToField" }
  /** Upload a newer or different document. */
  | { kind: "replaceDocument"; documentType: DocumentType }
  /** Nothing in the form fixes it: an officer decides, or it resolves with time. */
  | { kind: "none" };

export interface RuleResult {
  id: string;
  outcome: RuleOutcome;
  /** i18n key under "rules": what happened. */
  message: string;
  /** i18n key under "rules": how to fix it (`${message}Fix`). Absent on PASS and officer-only rules. */
  fix?: string;
  action?: RuleAction;
  /** The answer the rule is about, as "<section>.<path>" (e.g. "f.supervisorLicenceNo"). */
  field?: string;
  values?: Record<string, string | number>;
  /** FR-ELG-004: the date a time-based rule will pass, assuming continuation. */
  eligibleFrom?: string;
  /** Evidence used, for the officer (FR-L-004). */
  evidence?: Record<string, string | number | boolean | null>;
}

export interface EligibilityResult {
  outcome: RuleOutcome;
  rules: RuleResult[];
  /** Qualifying experience, when the category has an experience rule. */
  experience?: ExperienceSummary;
}

// ---------------------------------------------------------------------------
// Date helpers (UTC calendar dates as YYYY-MM-DD)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`);
export const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

export function addDays(day: string, days: number): string {
  return isoDay(toTime(day) + days * DAY_MS);
}

export function addMonths(day: string, months: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  const target = d.getUTCMonth() + months;
  d.setUTCMonth(target);
  // Clamp end-of-month overflow (e.g. 31 Jan + 1 month → 28/29 Feb).
  if (d.getUTCMonth() !== ((target % 12) + 12) % 12) d.setUTCDate(0);
  return isoDay(d.getTime());
}

export function addYears(day: string, years: number): string {
  return addMonths(day, years * 12);
}

export function ageOn(birth: string, on: string): number {
  const [by, bm, bd] = birth.split("-").map(Number) as [number, number, number];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export const daysBetween = (from: string, to: string) =>
  Math.round((toTime(to) - toTime(from)) / DAY_MS);

// ---------------------------------------------------------------------------
// Experience (BR-020…023, FR-E-007, FR-E-008)
// ---------------------------------------------------------------------------

export interface Period {
  from: string;
  /** Inclusive end. */
  to: string;
  source: "declared" | "register";
  category: string;
}

export interface ExperienceSummary {
  requiredMonths: number;
  /** The categories whose practice counts toward this requirement (e.g. FSLA for REA). */
  qualifyingCategories: string[];
  /** Whole months of qualifying experience after merging and exclusions. */
  months: number;
  days: number;
  qualifying: Period[];
  /** Periods removed because the licence was suspended (BR-022). */
  excluded: Array<{ from: string; to: string }>;
  overlapsMerged: boolean;
  ongoing: boolean;
  eligibleFrom?: string;
}

/** Merges overlapping or touching periods so time is never double-counted (BR-023). */
export function mergePeriods(periods: ReadonlyArray<{ from: string; to: string }>) {
  const sorted = [...periods]
    .filter((p) => p.from <= p.to)
    .sort((a, b) => (a.from < b.from ? -1 : 1));
  const merged: Array<{ from: string; to: string }> = [];
  for (const p of sorted) {
    const last = merged[merged.length - 1];
    if (last && p.from <= addDays(last.to, 1)) {
      if (p.to > last.to) last.to = p.to;
    } else merged.push({ from: p.from, to: p.to });
  }
  return merged;
}

/** Removes the given windows from merged periods (BR-022 suspension exclusion). */
export function subtractPeriods(
  periods: ReadonlyArray<{ from: string; to: string }>,
  holes: ReadonlyArray<{ from: string; to: string }>,
) {
  let result = [...periods];
  for (const hole of holes) {
    const next: Array<{ from: string; to: string }> = [];
    for (const p of result) {
      if (hole.to < p.from || hole.from > p.to) {
        next.push(p);
        continue;
      }
      if (hole.from > p.from) next.push({ from: p.from, to: addDays(hole.from, -1) });
      if (hole.to < p.to) next.push({ from: addDays(hole.to, 1), to: p.to });
    }
    result = next;
  }
  return result;
}

const totalDays = (periods: ReadonlyArray<{ from: string; to: string }>) =>
  periods.reduce((sum, p) => sum + daysBetween(p.from, p.to) + 1, 0);

const DAYS_PER_MONTH = 365.25 / 12;

export function computeExperience(
  data: ApplicationData,
  facts: EligibilityFacts,
  qualifying: readonly string[],
  requiredMonths: number,
): ExperienceSummary {
  const today = facts.today;
  // Register history is preferred to self-declared data for licensed periods (FR-E-007).
  const register: Period[] = facts.held
    .filter((l) => qualifying.includes(l.category))
    .map((l) => ({
      from: l.issuedAt,
      to: l.expiresAt < today ? l.expiresAt : today,
      source: "register",
      category: l.category,
    }));
  const declared: Period[] = (data.e?.records ?? [])
    .filter((r) => r.category && qualifying.includes(r.category) && r.from)
    .map((r) => ({
      from: r.from!,
      to: r.current || !r.to ? today : r.to < today ? r.to : today,
      source: "declared",
      category: r.category!,
    }));
  const all = [...register, ...declared];
  const merged = mergePeriods(all);
  const holes = facts.held.flatMap((l) =>
    (l.suspensions ?? []).map((s) => ({ from: s.from, to: s.to ?? today })),
  );
  const counted = subtractPeriods(merged, holes);
  const days = totalDays(counted);
  const months = Math.floor(days / DAYS_PER_MONTH);
  const ongoing =
    register.some((p) => p.to === today) || (data.e?.records ?? []).some((r) => r.current);
  const requiredDays = Math.ceil(requiredMonths * DAYS_PER_MONTH);
  const excluded = holes.filter((h) => merged.some((p) => !(h.to < p.from || h.from > p.to)));
  return {
    requiredMonths,
    qualifyingCategories: [...qualifying],
    months,
    days,
    qualifying: all,
    excluded,
    overlapsMerged: merged.length < all.length,
    ongoing,
    eligibleFrom: days < requiredDays && ongoing ? addDays(today, requiredDays - days) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Qualification mappings (BR-010, BR-011, BR-013, BR-014; Art. 12 register, FR-C-008)
// ---------------------------------------------------------------------------

const LEVEL_RANK: Record<EducationLevelC, number> = {
  A2: 1,
  A1: 2,
  A0: 3,
  BACHELOR: 3,
  POSTGRADUATE: 4,
  OTHER_RECOGNISED: 0,
};

/** Fields of study that make an A1 "relevant" or an A0 "business-related" for REA (BR-013). */
export const REA_RELEVANT_FIELDS: readonly FieldOfStudy[] = [
  "REAL_ESTATE",
  "ESTATE_MANAGEMENT_VALUATION",
  "VALUATION_PROPERTY_MANAGEMENT",
  "BUSINESS",
  "ECONOMICS",
  "FINANCE",
  "ACCOUNTING",
  "MARKETING",
  "LAW",
  "CIVIL_ENGINEERING",
  "ARCHITECTURE",
  "URBAN_PLANNING",
  "LAND_SURVEYING",
];

/** BR-014: the Broker qualification fields. */
export const BROKER_FIELDS: readonly FieldOfStudy[] = [
  "REAL_ESTATE",
  "ESTATE_MANAGEMENT_VALUATION",
  "VALUATION_PROPERTY_MANAGEMENT",
];

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export interface RuleInput {
  type: ApplicationType;
  category: Category;
  data: ApplicationData;
  facts: EligibilityFacts;
  thresholds?: RuleThresholds;
}

/**
 * The answer each rule is about (UX-004): where the wizard shows the rule and where its action
 * leads. Rules without an entry are about the application as a whole.
 */
export const RULE_FIELDS: Record<string, string> = {
  "BR-001": "b.dateOfBirth",
  "BR-010": "c.highestLevel",
  "BR-011": "c.highestLevel",
  "BR-012": "c.qualifications",
  "BR-013": "c.qualifications",
  "BR-014": "c.qualifications",
  "BR-015": "d.trainingProgramme",
  "BR-016": "d.examDate",
  "BR-020": "e.records",
  "BR-021": "e.records",
  "BR-022": "e.records",
  "BR-030": "f.supervisorLicenceNo",
  "BR-031": "g.brokerLicenceNo",
  "BR-032": "g.principalBrokerLicenceNo",
  "BR-033": "f.branchId",
  "BR-035": "f.firmId",
  "BR-036": "f.independentAuthorisationRef",
  "BR-060": "h",
  "BR-061": "h.criminalRecordIssuedOn",
  "BR-062": "h.codeOfConduct",
  "BR-070": "g.indemnity.to",
};

/** Rules a newer document fixes. */
const RULE_DOCUMENTS: Record<string, DocumentType> = {
  "BR-061": "criminalRecord",
};

/** Field overrides for one outcome of a rule (the answer that actually causes it). */
const SUFFIX_FIELDS: Record<string, string> = {
  "BR-015.missing": "d.trainingCompleted",
  "BR-016.missing": "d.examPassed",
};

const r = (
  id: string,
  outcome: RuleOutcome,
  suffix: string,
  extra: Omit<RuleResult, "id" | "outcome" | "message"> = {},
): RuleResult => {
  const message = `${id}.${suffix}`;
  const field = SUFFIX_FIELDS[message] ?? RULE_FIELDS[id];
  const guided = outcome === "FAIL" || outcome === "WARN";
  const action: RuleAction | undefined = !guided
    ? outcome === "NEEDS_ASSESSMENT"
      ? { kind: "none" }
      : undefined
    : RULE_DOCUMENTS[id]
      ? { kind: "replaceDocument", documentType: RULE_DOCUMENTS[id] }
      : field
        ? { kind: "goToField" }
        : { kind: "none" };
  return {
    id,
    outcome,
    message,
    ...(guided ? { fix: `${message}Fix` } : {}),
    ...(action ? { action } : {}),
    ...(field ? { field } : {}),
    ...extra,
  };
};

const INDIVIDUAL_RENEWAL_RULES = new Set(["BR-061", "BR-062", "BR-060", "BR-040"]);

/** Runs every applicable rule. Rules whose inputs are still empty are skipped (live mode). */
export function evaluateEligibility(input: RuleInput): EligibilityResult {
  const { category, type, data, facts } = input;
  const t = input.thresholds ?? DEFAULT_THRESHOLDS;
  const rules: RuleResult[] = [];
  const add = (result: RuleResult | null | undefined) => {
    if (!result) return;
    if (type === "RENEWAL" && !INDIVIDUAL_RENEWAL_RULES.has(result.id) && result.id !== "BR-070")
      return;
    rules.push(result);
  };
  const individual = category !== "REBF";
  let experience: ExperienceSummary | undefined;

  // BR-001/002: minimum age, all individual categories.
  if (individual && data.b?.dateOfBirth) {
    const age = ageOn(data.b.dateOfBirth, facts.today);
    add(
      age >= t.minAge
        ? r("BR-001", "PASS", "pass", { values: { age, min: t.minAge }, evidence: { age } })
        : r("BR-001", "FAIL", "fail", {
            values: { age, min: t.minAge },
            eligibleFrom: addYears(data.b.dateOfBirth, t.minAge),
            evidence: { age },
          }),
    );
  }

  // Education (BR-010, BR-011/013, BR-012, BR-014).
  const level = data.c?.highestLevel;
  const relied = (data.c?.qualifications ?? []).filter((q) => q.reliedUpon);
  if (level && (category === "RERA" || category === "FSLA")) {
    add(
      level === "OTHER_RECOGNISED"
        ? r("BR-010", "NEEDS_ASSESSMENT", "assess")
        : LEVEL_RANK[level] >= LEVEL_RANK.A2
          ? r("BR-010", "PASS", "pass", { evidence: { level } })
          : r("BR-010", "FAIL", "fail", { evidence: { level } }),
    );
  }
  if (level && category === "REA") {
    const fields = relied.map((q) => q.fieldOfStudy);
    let result: RuleResult;
    if (level === "OTHER_RECOGNISED") result = r("BR-011", "NEEDS_ASSESSMENT", "assess");
    else if (level === "BACHELOR" || level === "POSTGRADUATE") result = r("BR-011", "PASS", "pass");
    else if (level === "A2") result = r("BR-011", "FAIL", "fail", { evidence: { level } });
    else if (fields.some((f) => f && REA_RELEVANT_FIELDS.includes(f)))
      result = r("BR-011", "PASS", "pass", { evidence: { level } });
    else if (fields.some((f) => f === "OTHER" || !f))
      result = r("BR-013", "NEEDS_ASSESSMENT", "assess", { evidence: { level } });
    else result = r("BR-013", "FAIL", "fail", { evidence: { level } });
    add(result);
  }
  if (category === "BROKER" && relied.length > 0) {
    const fields = relied.map((q) => q.fieldOfStudy);
    add(
      fields.some((f) => f && BROKER_FIELDS.includes(f))
        ? r("BR-014", "PASS", "pass")
        : fields.some((f) => f === "OTHER")
          ? r("BR-014", "NEEDS_ASSESSMENT", "assess")
          : r("BR-014", "FAIL", "fail"),
    );
  }
  if (["RERA", "FSLA", "REA", "BROKER"].includes(category)) {
    const foreign = relied.filter((q) => q.isForeign);
    if (foreign.length > 0) add(r("BR-012", "WARN", "warn", { values: { count: foreign.length } }));
  }

  // BR-015: category training; FR-D-008 programme must match.
  const training = REQUIRED_TRAINING[category];
  if (training && data.d?.trainingCompleted !== undefined) {
    if (!data.d.trainingCompleted)
      add(r("BR-015", "FAIL", "missing", { values: { programme: training } }));
    else if (data.d.trainingProgramme && data.d.trainingProgramme !== training)
      add(r("BR-015", "FAIL", "mismatch", { values: { programme: training } }));
    else if (data.d.trainingProgramme)
      add(r("BR-015", "PASS", "pass", { values: { programme: training } }));
  }

  // BR-016: exam passed and within validity.
  if (EXAM_CATEGORIES.includes(category) && data.d?.examPassed) {
    if (data.d.examPassed !== "YES") add(r("BR-016", "FAIL", "missing"));
    else if (data.d.examDate) {
      const validUntil = addYears(data.d.examDate, t.examValidityYears);
      add(
        validUntil >= facts.today
          ? r("BR-016", "PASS", "pass", { values: { until: validUntil } })
          : r("BR-016", "FAIL", "expired", {
              values: { years: t.examValidityYears, until: validUntil },
            }),
      );
    }
  }

  // BR-020/021 (+022/023): experience.
  if (category === "REA" || category === "BROKER") {
    const required = category === "REA" ? t.reaExperienceMonths : t.brokerExperienceMonths;
    const qualifying =
      category === "REA" ? (t.reraCountsForRea ? ["FSLA", "RERA"] : ["FSLA"]) : ["REA"];
    const hasInput = (data.e?.records?.length ?? 0) > 0 || facts.held.length > 0;
    if (hasInput || data.e?.equivalentRecognised !== undefined) {
      experience = computeExperience(data, facts, qualifying, required);
      const id = category === "REA" ? "BR-020" : "BR-021";
      const values = {
        years: Math.floor(experience.months / 12),
        months: experience.months % 12,
        required: Math.round(required / 12),
      };
      const evidence = { months: experience.months, days: experience.days };
      if (experience.months >= required) add(r(id, "PASS", "pass", { values, evidence }));
      else if (category === "REA" && data.e?.equivalentRecognised)
        add(r(id, "NEEDS_ASSESSMENT", "equivalence", { values, evidence }));
      else
        add(
          r(id, "FAIL", experience.eligibleFrom ? "notYet" : "fail", {
            values,
            evidence,
            eligibleFrom: experience.eligibleFrom,
          }),
        );
      if (experience.excluded.length > 0)
        add(r("BR-022", "WARN", "excluded", { values: { count: experience.excluded.length } }));
    }
  }

  // BR-030: supervisor holds an ACTIVE licence in a category allowed to supervise.
  const allowed = SUPERVISOR_CATEGORIES[category];
  if (allowed && data.f?.supervisorLicenceNo) {
    const s = facts.supervisor;
    // `allowed` and `held` are category codes; the wizard shows their abbreviations.
    const values = { licence: data.f.supervisorLicenceNo, allowed: allowed.join(",") };
    if (!s) add(r("BR-030", "FAIL", "notFound", { values }));
    else if (s.holderIsApplicant) add(r("BR-030", "FAIL", "self", { values }));
    else if (s.status !== "ACTIVE") add(r("BR-030", "FAIL", "inactive", { values }));
    else if (!allowed.includes(s.category))
      add(r("BR-030", "FAIL", "category", { values: { ...values, held: s.category } }));
    else add(r("BR-030", "PASS", "pass", { values, evidence: { category: s.category } }));
  }

  // BR-031: Associate / Managing / Principal Broker need an ACTIVE Broker licence of their own.
  if (
    category === "ASSOCIATE_BROKER" ||
    category === "MANAGING_BROKER" ||
    category === "PRINCIPAL_BROKER"
  ) {
    const broker = facts.held.find((l) => l.category === "BROKER" && l.status === "ACTIVE");
    if (!broker) add(r("BR-031", "FAIL", "fail"));
    else if (daysBetween(facts.today, broker.expiresAt) <= t.brokerExpiryWarningDays)
      add(r("BR-031", "WARN", "expiring", { values: { date: broker.expiresAt } }));
    else add(r("BR-031", "PASS", "pass", { values: { licence: broker.licenceNo } }));
  }

  // BR-032: an REBF names exactly one active Principal Broker.
  if (category === "REBF" && data.g?.principalBrokerLicenceNo) {
    const p = facts.principal;
    if (p && p.category === "PRINCIPAL_BROKER" && p.status === "ACTIVE")
      add(r("BR-032", "PASS", "pass"));
    else if (facts.principalPending) add(r("BR-032", "WARN", "linked"));
    else add(r("BR-032", "FAIL", "fail"));
  }

  // BR-033: one Managing Broker per branch.
  if (category === "MANAGING_BROKER" && facts.branchHasManagingBroker !== undefined)
    add(facts.branchHasManagingBroker ? r("BR-033", "FAIL", "fail") : r("BR-033", "PASS", "pass"));

  // BR-035 / BR-036: affiliation or arrangement.
  const f = data.f;
  if (f) {
    const firmNamed = Boolean(f.firmId || f.firmName);
    if (category === "RERA" && f.reraMode === "REFERRAL" && f.referralApprovalRef)
      add(r("BR-035", "NEEDS_ASSESSMENT", "referral"));
    else if (firmNamed && facts.firm !== undefined) {
      if (facts.firm?.found && facts.firm.status === "ACTIVE") add(r("BR-035", "PASS", "pass"));
      else if (!f.firmId) add(r("BR-035", "NEEDS_ASSESSMENT", "unverified"));
      else add(r("BR-035", "FAIL", "inactive"));
    }
    if (category === "BROKER" && f.practiceArrangement === "INDEPENDENT")
      add(
        f.independentAuthorisationRef
          ? r("BR-036", "NEEDS_ASSESSMENT", "verify")
          : r("BR-036", "FAIL", "fail"),
      );
  }

  // BR-060/061/062: integrity.
  const h = data.h;
  if (h) {
    if (INTEGRITY_QUESTIONS.some((q) => h[q] === true))
      add(r("BR-060", "NEEDS_ASSESSMENT", "assess"));
    if (h.criminalRecordIssuedOn) {
      const validUntil = addMonths(h.criminalRecordIssuedOn, t.criminalRecordMonths);
      add(
        validUntil >= facts.today
          ? r("BR-061", "PASS", "pass", { values: { until: validUntil } })
          : r("BR-061", "FAIL", "fail", {
              values: {
                months: t.criminalRecordMonths,
                issued: h.criminalRecordIssuedOn,
                // The oldest issue date that still passes today.
                cutoff: addMonths(facts.today, -t.criminalRecordMonths),
              },
            }),
      );
    }
    if (h.codeOfConduct === false) add(r("BR-062", "FAIL", "fail"));
  }

  // BR-070: indemnity insurance valid at issue.
  const indemnity = data.g?.indemnity;
  if ((category === "PRINCIPAL_BROKER" || category === "REBF") && indemnity?.to)
    add(
      indemnity.to > facts.today
        ? r("BR-070", "PASS", "pass", { values: { until: indemnity.to } })
        : r("BR-070", "FAIL", "fail"),
    );

  // BR-040/042 (renewal) and BR-100 (upgrade): the licence concerned.
  const rel = facts.relatedLicence;
  if (type === "RENEWAL") {
    if (!rel) add(r("BR-040", "FAIL", "noLicence"));
    else if (rel.status === "ACTIVE")
      add(r("BR-040", "PASS", "pass", { values: { date: rel.expiresAt } }));
    else if (rel.status === "EXPIRED" && daysBetween(rel.expiresAt, facts.today) <= t.graceDays)
      add(r("BR-040", "WARN", "late", { values: { date: rel.expiresAt } }));
    else add(r("BR-040", "FAIL", "lapsed"));
  }
  if (type === "UPGRADE") {
    add(
      rel && rel.status === "ACTIVE"
        ? r("BR-100", "PASS", "pass", { values: { licence: rel.licenceNo } })
        : r("BR-100", "FAIL", "fail"),
    );
  }

  return { outcome: overall(rules), rules, experience };
}

export function overall(rules: readonly RuleResult[]): RuleOutcome {
  if (rules.some((x) => x.outcome === "FAIL")) return "FAIL";
  if (rules.some((x) => x.outcome === "NEEDS_ASSESSMENT")) return "NEEDS_ASSESSMENT";
  if (rules.some((x) => x.outcome === "WARN")) return "WARN";
  return "PASS";
}

/** Renewal timing (BR-040): before the window, in the window, late (grace) or lapsed. */
export function renewalTiming(
  status: LicenseStatus,
  expiresAt: string,
  today: string,
  t: RuleThresholds = DEFAULT_THRESHOLDS,
): "notYet" | "open" | "late" | "closed" {
  if (status === "ACTIVE") {
    return daysBetween(today, expiresAt) <= t.renewalWindowDays ? "open" : "notYet";
  }
  if (status === "EXPIRED" && daysBetween(expiresAt, today) <= t.graceDays) return "late";
  return "closed";
}
