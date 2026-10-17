import { z } from "zod";
import { APPLICATION_STATUSES, LICENSE_STATUSES } from "./status";
import { APPLICATION_TYPES, CATEGORIES } from "./categories";
import { DOCUMENT_TYPES } from "./checklist";

/**
 * Back-office contracts: confirmations (FR-F-007), Section L review (FR-L-001…010), information
 * requests (FR-L-007), Section M decisions (FR-M-001…017) and register administration (FR-RA-001).
 */

const reason = z
  .string()
  .trim()
  .min(10, "validation.reasonTooShort")
  .max(2000, "validation.tooLong");
const note = z.string().trim().max(2000, "validation.tooLong").optional();

// ---------------------------------------------------------------------------
// Confirmations (FR-F-007, FR-FIRM-003, SRS §4.3)
// ---------------------------------------------------------------------------

export const CONFIRMATION_KINDS = ["SUPERVISOR", "PRINCIPAL_BROKER", "DESIGNATION"] as const;
export type ConfirmationKind = (typeof CONFIRMATION_KINDS)[number];

/** Days an addressee has to answer (FR-WF-006). */
export const CONFIRMATION_TTL_DAYS = 14;

export const respondConfirmationSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(50),
  confirm: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const overrideConfirmationSchema = z.object({ id: z.uuid(), reason });

// ---------------------------------------------------------------------------
// Section L (FR-L-003…010, BR-090)
// ---------------------------------------------------------------------------

export const VERIFICATION_ITEMS = [
  "identity",
  "education",
  "experience",
  "trainingExam",
  "affiliation",
  "integrity",
] as const;
export type VerificationItem = (typeof VERIFICATION_ITEMS)[number];

export const VERIFICATION_OUTCOMES = ["VERIFIED", "PENDING", "FAILED", "NA"] as const;
export type VerificationOutcome = (typeof VERIFICATION_OUTCOMES)[number];

export const DOCUMENTATION_OUTCOMES = ["COMPLETE", "INCOMPLETE"] as const;
export const ELIGIBILITY_OUTCOMES = ["SATISFIED", "NOT_SATISFIED", "FURTHER_ASSESSMENT"] as const;
export type EligibilityOutcome = (typeof ELIGIBILITY_OUTCOMES)[number];
export const RECOMMENDATIONS = ["APPROVE", "REFER", "REJECT"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const REJECTION_REASON_CODES = [
  "INELIGIBLE_AGE",
  "INSUFFICIENT_EDUCATION",
  "INSUFFICIENT_EXPERIENCE",
  "TRAINING_OR_EXAM",
  "INTEGRITY",
  "FALSE_INFORMATION",
  "NO_SUPERVISION",
  "OTHER",
] as const;

export const reviewDraftSchema = z.object({
  applicationId: z.uuid(),
  checks: z.partialRecord(
    z.enum(VERIFICATION_ITEMS),
    z.object({
      outcome: z.enum(VERIFICATION_OUTCOMES),
      note: z.string().trim().max(500).optional(),
    }),
  ),
  documentation: z.enum(DOCUMENTATION_OUTCOMES).optional(),
  documentationOverrideReason: note,
  eligibility: z.enum(ELIGIBILITY_OUTCOMES).optional(),
  eligibilityOverrideReason: note,
  internalComment: note,
  applicantComment: note,
  recommendation: z.enum(RECOMMENDATIONS).optional(),
  reasonCodes: z.array(z.enum(REJECTION_REASON_CODES)).max(8).optional(),
  reasons: note,
  legalReference: z.string().trim().max(200).optional(),
});
export type ReviewDraft = z.infer<typeof reviewDraftSchema>;

export const signReviewSchema = z.object({
  applicationId: z.uuid(),
  password: z.string().min(1).max(256),
});

export const documentVerdictSchema = z.object({
  documentId: z.uuid(),
  verdict: z.enum(["VERIFIED", "REJECTED"]),
  reason: z.string().trim().max(500).optional(),
});

export const INFO_REQUEST_TEMPLATES = [
  "missingDocument",
  "clarifyExperience",
  "supervisor",
  "custom",
] as const;

export const informationRequestSchema = z.object({
  applicationId: z.uuid(),
  template: z.enum(INFO_REQUEST_TEMPLATES),
  message: z.string().trim().min(10, "validation.reasonTooShort").max(2000),
  /** Sections the applicant may edit (FR-WF-002). */
  sections: z.array(z.enum(["b", "c", "d", "e", "f", "g", "h"])).max(7),
  /** Documents the applicant may replace or add. */
  documents: z.array(z.enum(DOCUMENT_TYPES)).max(DOCUMENT_TYPES.length),
  /** Named extra requirement (FR-I-005), shown as "Other document". */
  extraDocument: z.string().trim().max(200).optional(),
  dueInDays: z.number().int().min(1).max(60),
});

export const referSchema = z.object({ applicationId: z.uuid(), reason });
export const conflictSchema = z.object({ applicationId: z.uuid(), reason });
export const assignSchema = z.object({ applicationId: z.uuid(), officerId: z.uuid() });

// ---------------------------------------------------------------------------
// Section M (FR-M-001…017, BR-091, BR-092)
// ---------------------------------------------------------------------------

export const DECISIONS = ["APPROVED", "APPROVED_WITH_CONDITIONS", "DEFERRED", "REJECTED"] as const;
export type DecisionType = (typeof DECISIONS)[number];

/** Standard conditions library (FR-M-011). */
export const STANDARD_CONDITIONS = [
  "SUPERVISED_PRACTICE",
  "REFERRAL_ONLY",
  "TERRITORY_LIMITED",
  "REPORT_QUARTERLY",
  "COMPLETE_TRAINING",
  "PROVIDE_INSURANCE",
] as const;

export const decisionConditionSchema = z.object({
  code: z.enum([...STANDARD_CONDITIONS, "CUSTOM"]),
  text: z.string().trim().max(300).optional(),
  endsOn: z.union([z.iso.date(), z.literal("")]).optional(),
  publicOnRegister: z.boolean().default(true),
});
export type DecisionCondition = z.infer<typeof decisionConditionSchema>;

export const decisionSchema = z
  .object({
    applicationId: z.uuid(),
    decision: z.enum(DECISIONS),
    approvedCategory: z.enum(CATEGORIES).optional(),
    conditions: z.array(decisionConditionSchema).max(10).default([]),
    geoScope: z.array(z.string().max(20)).max(40).default([]),
    reasons: z.string().trim().max(2000).optional(),
    reasonCodes: z.array(z.enum(REJECTION_REASON_CODES)).max(8).default([]),
    password: z.string().min(1).max(256),
  })
  .superRefine((value, ctx) => {
    // FR-M-012: reasons are mandatory for conditional, deferred and rejected decisions.
    if (value.decision !== "APPROVED" && (value.reasons ?? "").length < 10)
      ctx.addIssue({ code: "custom", path: ["reasons"], message: "validation.reasonTooShort" });
    if (value.decision === "APPROVED_WITH_CONDITIONS" && value.conditions.length === 0)
      ctx.addIssue({ code: "custom", path: ["conditions"], message: "validation.atLeastOne" });
    if (value.decision === "REJECTED" && value.reasonCodes.length === 0)
      ctx.addIssue({ code: "custom", path: ["reasonCodes"], message: "validation.atLeastOne" });
  });
export type DecisionInput = z.input<typeof decisionSchema>;

// ---------------------------------------------------------------------------
// Register administration (FR-RA-001/002, FR-WF-010/011)
// ---------------------------------------------------------------------------

export const REGISTER_ACTIONS = ["SUSPEND", "LIFT", "REVOKE", "SURRENDER", "CORRECT"] as const;
export type RegisterAction = (typeof REGISTER_ACTIONS)[number];
/** Actions that need a second person (maker-checker for revocation, FR-RA-001). */
export const CHECKED_REGISTER_ACTIONS: readonly RegisterAction[] = ["REVOKE"];

export const registerActionSchema = z
  .object({
    licenceId: z.uuid(),
    action: z.enum(REGISTER_ACTIONS),
    reason,
    reference: z.string().trim().min(2, "validation.required").max(80),
    startsOn: z.union([z.iso.date(), z.literal("")]).optional(),
    endsOn: z.union([z.iso.date(), z.literal("")]).optional(),
    /** CORRECT: the public display name. */
    displayName: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "SUSPEND" && !value.startsOn)
      ctx.addIssue({ code: "custom", path: ["startsOn"], message: "validation.required" });
    if (
      value.action === "SUSPEND" &&
      value.startsOn &&
      value.endsOn &&
      value.endsOn < value.startsOn
    )
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: "validation.dateOrder" });
    if (value.action === "CORRECT" && !value.displayName)
      ctx.addIssue({ code: "custom", path: ["displayName"], message: "validation.required" });
  });
export type RegisterActionInput = z.input<typeof registerActionSchema>;

export const decideRegisterActionSchema = z.object({ id: z.uuid(), approve: z.boolean(), note });

export const endAffiliationSchema = z.object({
  licenceId: z.uuid(),
  effectiveOn: z.iso.date(),
  reason,
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const QUEUE_VIEWS = ["mine", "unassigned", "all", "sla", "decision"] as const;

export const queueQuerySchema = z.object({
  view: z.enum(QUEUE_VIEWS).optional().catch(undefined),
  status: z.enum(APPLICATION_STATUSES).optional().catch(undefined),
  category: z.enum(CATEGORIES).optional().catch(undefined),
  type: z.enum(APPLICATION_TYPES).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});
export type QueueQuery = z.infer<typeof queueQuerySchema>;

export const REGISTER_PUBLIC_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "REVOKED",
  "EXPIRED",
  "LAPSED",
] as const;

export const registerQuerySchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.enum(CATEGORIES).optional().catch(undefined),
  status: z.enum(LICENSE_STATUSES).optional().catch(undefined),
  district: z.string().trim().max(20).optional().catch(undefined),
  kind: z.enum(["PERSON", "FIRM"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});
export type RegisterQuery = z.infer<typeof registerQuerySchema>;

/** SLA defaults (FR-WF-006): review starts within 3 working days; applicants answer in 30. */
export const SLA = {
  reviewStartDays: 3,
  reviewCompleteDays: 15,
  informationResponseDays: 30,
  decisionDays: 5,
} as const;
