import { CATEGORIES, type Category } from "./categories";

/**
 * Public "Am I eligible?" pre-check (FR-PORTAL-006), derived from the category eligibility
 * matrix (SRS §3.2). It is indicative only: it recommends a category and the documents to
 * prepare, and never makes an eligibility decision (the eligibility engine does, FR-ELG).
 */
export const EDUCATION_LEVELS = ["NONE", "A2", "A1_OR_HIGHER", "REAL_ESTATE_DEGREE"] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const HELD_LICENCES = ["NONE", "RERA", "FSLA", "REA", "BROKER"] as const;
export type HeldLicence = (typeof HELD_LICENCES)[number];

export interface PrecheckAnswers {
  applicantType: "INDIVIDUAL" | "ORGANISATION";
  adult: boolean;
  education: EducationLevel;
  licence: HeldLicence;
  /** Whole years practised under the held licence (0 when none). */
  years: number;
}

export type PrecheckRequirement = "adult" | "education" | "experience" | "brokerLicence" | "firm";

export interface CategoryPrecheck {
  category: Category;
  status: "eligible" | "notYet" | "notEligible";
  /** Requirements not met yet. */
  missing: PrecheckRequirement[];
  /** Experience progress towards the threshold, when experience is the gap. */
  experience?: { years: number; required: number };
}

export const REQUIRED_EXPERIENCE_YEARS = 3;

/** Documents to prepare, per category (subset of SRS Appendix B shown publicly). */
export const PRECHECK_DOCUMENTS: Record<Category, readonly string[]> = {
  RERA: ["nationalId", "photo", "education", "referralArrangement"],
  FSLA: ["nationalId", "photo", "education", "entryTraining", "supervisorConfirmation"],
  REA: [
    "nationalId",
    "photo",
    "education",
    "professionalTraining",
    "reaExam",
    "experience",
    "supervisorConfirmation",
  ],
  BROKER: ["nationalId", "photo", "education", "advancedTraining", "brokerExam", "experience"],
  ASSOCIATE_BROKER: ["nationalId", "brokerLicence", "firmAffiliation"],
  MANAGING_BROKER: ["nationalId", "brokerLicence", "firmAffiliation", "branchDetails"],
  PRINCIPAL_BROKER: ["nationalId", "brokerLicence", "firmAffiliation", "indemnityInsurance"],
  REBF: [
    "companyRegistration",
    "directorsList",
    "principalBroker",
    "officeAddress",
    "indemnityInsurance",
  ],
};

const EDUCATION_RANK: Record<EducationLevel, number> = {
  NONE: 0,
  A2: 1,
  A1_OR_HIGHER: 2,
  REAL_ESTATE_DEGREE: 3,
};

function check(category: Category, a: PrecheckAnswers): CategoryPrecheck {
  if (category === "REBF") {
    return a.applicantType === "ORGANISATION"
      ? { category, status: "eligible", missing: [] }
      : { category, status: "notEligible", missing: ["firm"] };
  }
  if (a.applicantType === "ORGANISATION") {
    return { category, status: "notEligible", missing: ["firm"] };
  }

  const missing: PrecheckRequirement[] = [];
  if (!a.adult) missing.push("adult");
  const edu = EDUCATION_RANK[a.education];
  let experience: CategoryPrecheck["experience"];

  switch (category) {
    case "RERA":
    case "FSLA":
      if (edu < EDUCATION_RANK.A2) missing.push("education");
      break;
    case "REA": {
      if (edu < EDUCATION_RANK.A1_OR_HIGHER) missing.push("education");
      const years =
        a.licence === "FSLA"
          ? a.years
          : a.licence === "REA" || a.licence === "BROKER"
            ? REQUIRED_EXPERIENCE_YEARS
            : 0;
      if (years < REQUIRED_EXPERIENCE_YEARS) {
        missing.push("experience");
        experience = { years, required: REQUIRED_EXPERIENCE_YEARS };
      }
      break;
    }
    case "BROKER": {
      if (edu < EDUCATION_RANK.REAL_ESTATE_DEGREE) missing.push("education");
      const years =
        a.licence === "REA" ? a.years : a.licence === "BROKER" ? REQUIRED_EXPERIENCE_YEARS : 0;
      if (years < REQUIRED_EXPERIENCE_YEARS) {
        missing.push("experience");
        experience = { years, required: REQUIRED_EXPERIENCE_YEARS };
      }
      break;
    }
    case "ASSOCIATE_BROKER":
    case "MANAGING_BROKER":
    case "PRINCIPAL_BROKER":
      if (a.licence !== "BROKER") missing.push("brokerLicence");
      break;
  }

  if (missing.length === 0) return { category, status: "eligible", missing };
  // Only time stands between the applicant and the category: "not yet", with progress.
  const onlyExperience = missing.length === 1 && missing[0] === "experience" && experience;
  const onTrack =
    onlyExperience &&
    ((category === "REA" && a.licence === "FSLA") ||
      (category === "BROKER" && a.licence === "REA"));
  return { category, status: onTrack ? "notYet" : "notEligible", missing, experience };
}

/** Ladder order used to pick the highest category the applicant can apply for today. */
const RECOMMENDATION_ORDER: Category[] = [
  "REBF",
  "PRINCIPAL_BROKER",
  "MANAGING_BROKER",
  "ASSOCIATE_BROKER",
  "BROKER",
  "REA",
  "FSLA",
  "RERA",
];

export function precheck(answers: PrecheckAnswers): {
  results: CategoryPrecheck[];
  recommended: Category | null;
  next: CategoryPrecheck | null;
} {
  const results = CATEGORIES.map((category) => check(category, answers));
  const byCategory = new Map(results.map((r) => [r.category, r]));
  const held = answers.licence === "NONE" ? null : answers.licence;
  // Recommend the highest eligible category that is not the one already held.
  const recommended =
    RECOMMENDATION_ORDER.find((c) => c !== held && byCategory.get(c)?.status === "eligible") ??
    null;
  const next = results.find((r) => r.status === "notYet") ?? null;
  return { results, recommended, next };
}

/** Headline requirements per category for public comparison graphics (SRS §3.2). */
export interface CategoryRequirements {
  adult: boolean;
  education: EducationLevel | null;
  /** Years of documented practice in a lower category. */
  experience: { years: number; as: Category } | null;
  prerequisite: Category | null;
  training: boolean;
  exam: boolean;
  supervised: boolean;
}

export const CATEGORY_REQUIREMENTS: Record<Category, CategoryRequirements> = {
  RERA: {
    adult: true,
    education: "A2",
    experience: null,
    prerequisite: null,
    training: false,
    exam: false,
    supervised: true,
  },
  FSLA: {
    adult: true,
    education: "A2",
    experience: null,
    prerequisite: null,
    training: true,
    exam: false,
    supervised: true,
  },
  REA: {
    adult: true,
    education: "A1_OR_HIGHER",
    experience: { years: 3, as: "FSLA" },
    prerequisite: null,
    training: true,
    exam: true,
    supervised: true,
  },
  BROKER: {
    adult: true,
    education: "REAL_ESTATE_DEGREE",
    experience: { years: 3, as: "REA" },
    prerequisite: null,
    training: true,
    exam: true,
    supervised: false,
  },
  ASSOCIATE_BROKER: {
    adult: true,
    education: null,
    experience: null,
    prerequisite: "BROKER",
    training: false,
    exam: false,
    supervised: true,
  },
  MANAGING_BROKER: {
    adult: true,
    education: null,
    experience: null,
    prerequisite: "BROKER",
    training: true,
    exam: false,
    supervised: false,
  },
  PRINCIPAL_BROKER: {
    adult: true,
    education: null,
    experience: null,
    prerequisite: "BROKER",
    training: false,
    exam: false,
    supervised: false,
  },
  REBF: {
    adult: false,
    education: null,
    experience: null,
    prerequisite: "PRINCIPAL_BROKER",
    training: false,
    exam: false,
    supervised: false,
  },
};
