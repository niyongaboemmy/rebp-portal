import { z } from "zod";
import {
  APPLICATION_TYPES,
  CATEGORIES,
  CATEGORY_INFO,
  type ApplicationType,
  type Category,
} from "./categories";
import type { ApplicationStatus } from "./status";

/**
 * Application domain (SRS §3.3, §4.1, FR-A-001…006, FR-WIZ-001…003): which application types are
 * open for which categories, the reference-number format, and which wizard steps apply.
 */

// ---------------------------------------------------------------------------
// Application type × category (FR-DOM-001)
// ---------------------------------------------------------------------------

/** Types delivered in the pilot. Change of affiliation and reinstatement follow in R2 (Plan §3.2 E17). */
export const PILOT_APPLICATION_TYPES = [
  "NEW",
  "UPGRADE",
  "RENEWAL",
  "FIRM_REGISTRATION",
] as const satisfies readonly ApplicationType[];

export const UPGRADE_PATHS: Partial<Record<Category, readonly Category[]>> = {
  REA: ["FSLA"],
  BROKER: ["REA"],
  ASSOCIATE_BROKER: ["BROKER"],
  MANAGING_BROKER: ["BROKER"],
  PRINCIPAL_BROKER: ["BROKER"],
};

export type TypeUnavailableReason =
  | "firmOnly"
  | "individualOnly"
  | "needsLicence"
  | "needsBrokerLicence"
  | "needsLowerLicence"
  | "alreadyLicensed"
  | "notInPilot"
  | "notApplicable";

export interface HeldLicenceSummary {
  id: string;
  category: Category;
  status: "ACTIVE" | "EXPIRED" | "LAPSED" | "SUSPENDED" | "REVOKED" | "SURRENDERED" | "SUPERSEDED";
  expiresAt: Date;
  /** Renewal window and grace are evaluated by the caller against thresholds. */
  renewable?: boolean;
}

/**
 * Whether a category may be chosen for a type, and why not (FR-DOM-001 "explain why an option is
 * unavailable"). Licence-dependent checks use the licences linked to the account.
 */
export function categoryAvailability(
  type: ApplicationType,
  category: Category,
  ctx: { applicantType: "INDIVIDUAL" | "ORGANISATION"; licences: readonly HeldLicenceSummary[] },
): { ok: true } | { ok: false; reason: TypeUnavailableReason } {
  const info = CATEGORY_INFO[category];
  const active = (c: Category) =>
    ctx.licences.some((l) => l.category === c && l.status === "ACTIVE");
  if (!(PILOT_APPLICATION_TYPES as readonly string[]).includes(type))
    return { ok: false, reason: "notInPilot" };

  if (type === "FIRM_REGISTRATION") {
    if (category !== "REBF") return { ok: false, reason: "notApplicable" };
    if (ctx.applicantType !== "ORGANISATION") return { ok: false, reason: "firmOnly" };
    return { ok: true };
  }
  if (category === "REBF" && type === "NEW") return { ok: false, reason: "notApplicable" };
  if (info.applicantType === "INDIVIDUAL" && ctx.applicantType === "ORGANISATION")
    return { ok: false, reason: "individualOnly" };
  if (info.applicantType === "ORGANISATION" && ctx.applicantType === "INDIVIDUAL")
    return { ok: false, reason: "firmOnly" };

  switch (type) {
    case "NEW":
      if (active(category)) return { ok: false, reason: "alreadyLicensed" };
      if (CATEGORY_INFO[category].tier === "broker" && category !== "BROKER" && !active("BROKER"))
        return { ok: false, reason: "needsBrokerLicence" };
      return { ok: true };
    case "UPGRADE": {
      const from = UPGRADE_PATHS[category];
      if (!from) return { ok: false, reason: "notApplicable" };
      if (active(category)) return { ok: false, reason: "alreadyLicensed" };
      return from.some(active) ? { ok: true } : { ok: false, reason: "needsLowerLicence" };
    }
    case "RENEWAL":
      return ctx.licences.some((l) => l.category === category && l.renewable)
        ? { ok: true }
        : { ok: false, reason: "needsLicence" };
    default:
      return { ok: false, reason: "notInPilot" };
  }
}

// ---------------------------------------------------------------------------
// Reference numbers (FR-A-001, FR-N-001)
// ---------------------------------------------------------------------------

export const TYPE_CODES: Record<ApplicationType, string> = {
  NEW: "NEW",
  UPGRADE: "UPG",
  RENEWAL: "REN",
  CHANGE_OF_AFFILIATION: "CHG",
  REINSTATEMENT: "RST",
  FIRM_REGISTRATION: "FRM",
};

/** Luhn check digit over a digit string. */
export function luhnDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** `REBP-{YYYY}-{TYPECODE}-{SEQ6}-{CHK}`, e.g. REBP-2026-NEW-000123-7. */
export function formatReference(year: number, type: ApplicationType, seq: number): string {
  const serial = String(seq).padStart(6, "0");
  return `REBP-${year}-${TYPE_CODES[type]}-${serial}-${luhnDigit(`${year}${serial}`)}`;
}

const REFERENCE_PATTERN = /^REBP-(\d{4})-(NEW|UPG|REN|CHG|RST|FRM)-(\d{6})-(\d)$/;

export function isValidReference(value: string): boolean {
  const match = REFERENCE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, , serial, check] = match;
  return luhnDigit(`${year}${serial}`) === Number(check);
}

/** Persistent registration numbers: RP-000123 (practitioner), RF-000045 (firm). */
export function formatRegistrationNo(kind: "PERSON" | "FIRM", seq: number): string {
  return `${kind === "PERSON" ? "RP" : "RF"}-${String(seq).padStart(6, "0")}`;
}

export const LICENCE_PREFIX: Record<Category, string> = {
  RERA: "RRA",
  FSLA: "FSL",
  REA: "REA",
  BROKER: "BRK",
  ASSOCIATE_BROKER: "ABK",
  MANAGING_BROKER: "MBK",
  PRINCIPAL_BROKER: "PBK",
  REBF: "FRM",
};

/** Licence numbers are unique per licence instance: e.g. FSL-2026-00042. */
export function formatLicenceNo(category: Category, year: number, seq: number): string {
  return `${LICENCE_PREFIX[category]}-${year}-${String(seq).padStart(5, "0")}`;
}

/**
 * Forgiving licence-number input (UX-004, guidance level 1): "brk 2022 104" and "BRK/2022/104"
 * become "BRK-2022-00104". Anything that doesn't look like a licence number is only uppercased.
 */
export function normaliseLicenceNo(raw: string): string {
  const value = raw.trim().toUpperCase();
  const match = /^([A-Z]{2,4})[\s\-_./]*(\d{4})[\s\-_./]*(\d{1,5})$/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]!.padStart(5, "0")}` : value;
}

// ---------------------------------------------------------------------------
// Wizard steps (FR-WIZ-001/003, SRS §3.2 "Section F applies", FR-G-000)
// ---------------------------------------------------------------------------

export const SECTION_KEYS = ["b", "c", "d", "e", "f", "g", "h"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const STEP_KEYS = ["a", ...SECTION_KEYS, "i", "review"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

const FULL_INDIVIDUAL: readonly SectionKey[] = ["b", "c", "d", "e", "f", "g", "h"];

const SECTIONS_BY_CATEGORY: Record<Category, readonly SectionKey[]> = {
  RERA: ["b", "c", "f", "g", "h"],
  FSLA: ["b", "c", "d", "f", "g", "h"],
  REA: FULL_INDIVIDUAL,
  BROKER: FULL_INDIVIDUAL,
  ASSOCIATE_BROKER: ["b", "f", "g", "h"],
  MANAGING_BROKER: ["b", "f", "g", "h"],
  // Firm data for a Principal Broker lives in G7 (SRS §3.2 "Section F applies: partly").
  PRINCIPAL_BROKER: ["b", "g", "h"],
  // Sections B–E are replaced by the corporate data in G8 (FR-G8-013).
  REBF: ["g", "h"],
};

/** Renewal is a short, pre-filled flow (FR-REN-001): confirm identity, affiliation and integrity. */
const RENEWAL_SECTIONS: Record<Category, readonly SectionKey[]> = {
  RERA: ["b", "f", "h"],
  FSLA: ["b", "f", "h"],
  REA: ["b", "f", "h"],
  BROKER: ["b", "f", "h"],
  ASSOCIATE_BROKER: ["b", "f", "h"],
  MANAGING_BROKER: ["b", "f", "h"],
  PRINCIPAL_BROKER: ["b", "h"],
  REBF: ["g", "h"],
};

export function sectionsFor(type: ApplicationType, category: Category): readonly SectionKey[] {
  return type === "RENEWAL" ? RENEWAL_SECTIONS[category] : SECTIONS_BY_CATEGORY[category];
}

/** Ordered wizard steps: A, the applicable sections, the document checklist (I), then review (J/K). */
export function stepsFor(type: ApplicationType, category: Category): StepKey[] {
  return ["a", ...sectionsFor(type, category), "i", "review"];
}

/** Which categories must operate under a firm or arrangement (Section F header, BR-035). */
export const AFFILIATED_CATEGORIES: readonly Category[] = [
  "RERA",
  "FSLA",
  "REA",
  "ASSOCIATE_BROKER",
  "MANAGING_BROKER",
];

/** Supervisor categories allowed per supervised category (BR-030). */
export const SUPERVISOR_CATEGORIES: Partial<Record<Category, readonly Category[]>> = {
  RERA: ["BROKER", "ASSOCIATE_BROKER", "MANAGING_BROKER", "PRINCIPAL_BROKER", "REA"],
  FSLA: ["REA", "BROKER", "ASSOCIATE_BROKER", "MANAGING_BROKER", "PRINCIPAL_BROKER"],
  REA: ["BROKER", "ASSOCIATE_BROKER", "MANAGING_BROKER", "PRINCIPAL_BROKER"],
};

/** Categories whose supervisor is named in Section F and must confirm digitally (FR-F-007). */
export const SUPERVISED_CATEGORIES = Object.keys(SUPERVISOR_CATEGORIES) as Category[];

// ---------------------------------------------------------------------------
// State machine (FR-WF-001, FR-WF-002)
// ---------------------------------------------------------------------------

export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "PENDING_CONFIRMATIONS", "SUBMITTED", "WITHDRAWN", "EXPIRED_DRAFT"],
  PENDING_PAYMENT: ["PENDING_CONFIRMATIONS", "SUBMITTED", "WITHDRAWN", "DRAFT"],
  PENDING_CONFIRMATIONS: ["SUBMITTED", "ACTION_REQUIRED", "WITHDRAWN"],
  SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN"],
  UNDER_REVIEW: ["ACTION_REQUIRED", "FURTHER_ASSESSMENT", "PENDING_DECISION", "WITHDRAWN"],
  ACTION_REQUIRED: ["UNDER_REVIEW", "PENDING_CONFIRMATIONS", "WITHDRAWN"],
  FURTHER_ASSESSMENT: ["PENDING_DECISION", "UNDER_REVIEW", "ACTION_REQUIRED", "WITHDRAWN"],
  PENDING_DECISION: [
    "APPROVED",
    "APPROVED_WITH_CONDITIONS",
    "DEFERRED",
    "REJECTED",
    "UNDER_REVIEW",
    "WITHDRAWN",
  ],
  APPROVED: ["LICENSE_ISSUED"],
  APPROVED_WITH_CONDITIONS: ["LICENSE_ISSUED"],
  DEFERRED: ["ACTION_REQUIRED"],
  REJECTED: [],
  LICENSE_ISSUED: [],
  WITHDRAWN: [],
  EXPIRED_DRAFT: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return APPLICATION_TRANSITIONS[from].includes(to);
}

export const EDITABLE_STATUSES: readonly ApplicationStatus[] = ["DRAFT", "ACTION_REQUIRED"];
/** FR-WF-005: withdrawal is possible before a decision. */
export const WITHDRAWABLE_STATUSES: readonly ApplicationStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PENDING_CONFIRMATIONS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
];
export const OPEN_STATUSES: readonly ApplicationStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PENDING_CONFIRMATIONS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_DECISION",
  "DEFERRED",
];

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export const createApplicationSchema = z.object({
  type: z.enum(APPLICATION_TYPES),
  category: z.enum(CATEGORIES),
  relatedLicenceId: z.uuid().optional(),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const changeCategorySchema = z.object({
  applicationId: z.uuid(),
  category: z.enum(CATEGORIES),
});

export const APPLICATION_FILTERS = ["all", "open", "action", "closed"] as const;
