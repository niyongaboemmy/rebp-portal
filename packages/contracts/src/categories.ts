/**
 * Professional categories (SRS §3.1, §3.2) and application types (SRS §3.3, form A.3/A.4).
 */
export const CATEGORIES = [
  "RERA",
  "FSLA",
  "REA",
  "BROKER",
  "ASSOCIATE_BROKER",
  "MANAGING_BROKER",
  "PRINCIPAL_BROKER",
  "REBF",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const APPLICATION_TYPES = [
  "NEW",
  "UPGRADE",
  "RENEWAL",
  "CHANGE_OF_AFFILIATION",
  "REINSTATEMENT",
  "FIRM_REGISTRATION",
] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];

export type CategoryTier = "entry" | "agent" | "broker" | "firm";

export interface CategoryInfo {
  code: Category;
  /** Short label used in badges and register listings. */
  abbreviation: string;
  tier: CategoryTier;
  applicantType: "INDIVIDUAL" | "ORGANISATION";
  /** Form REBP–REG–01 Section G subsection. */
  section: `G${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
}

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  RERA: {
    code: "RERA",
    abbreviation: "RERA",
    tier: "entry",
    applicantType: "INDIVIDUAL",
    section: "G1",
  },
  FSLA: {
    code: "FSLA",
    abbreviation: "FSLA",
    tier: "entry",
    applicantType: "INDIVIDUAL",
    section: "G2",
  },
  REA: {
    code: "REA",
    abbreviation: "REA",
    tier: "agent",
    applicantType: "INDIVIDUAL",
    section: "G3",
  },
  BROKER: {
    code: "BROKER",
    abbreviation: "Broker",
    tier: "broker",
    applicantType: "INDIVIDUAL",
    section: "G4",
  },
  ASSOCIATE_BROKER: {
    code: "ASSOCIATE_BROKER",
    abbreviation: "Assoc. Broker",
    tier: "broker",
    applicantType: "INDIVIDUAL",
    section: "G5",
  },
  MANAGING_BROKER: {
    code: "MANAGING_BROKER",
    abbreviation: "Managing Broker",
    tier: "broker",
    applicantType: "INDIVIDUAL",
    section: "G6",
  },
  PRINCIPAL_BROKER: {
    code: "PRINCIPAL_BROKER",
    abbreviation: "Principal Broker",
    tier: "broker",
    applicantType: "INDIVIDUAL",
    section: "G7",
  },
  REBF: {
    code: "REBF",
    abbreviation: "REBF",
    tier: "firm",
    applicantType: "ORGANISATION",
    section: "G8",
  },
};
