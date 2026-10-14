/**
 * Lifecycle statuses (SRS §4.1–4.3) and the visual tone each one maps to (ADR-009). Every
 * status badge, timeline node and chart reads its tone from here, so a status always looks
 * the same everywhere — and never relies on colour alone (the UI pairs tone with icon + label).
 */
export const APPLICATION_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PENDING_CONFIRMATIONS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_DECISION",
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
  "DEFERRED",
  "REJECTED",
  "LICENSE_ISSUED",
  "WITHDRAWN",
  "EXPIRED_DRAFT",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const LICENSE_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "LAPSED",
  "SUSPENDED",
  "REVOKED",
  "SURRENDERED",
  "SUPERSEDED",
] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const CONFIRMATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type ConfirmationStatus = (typeof CONFIRMATION_STATUSES)[number];

/** Reserved status tones — never reused as chart series colours. */
export type StatusTone = "good" | "warning" | "critical" | "info" | "neutral";

export const APPLICATION_STATUS_TONES: Record<ApplicationStatus, StatusTone> = {
  DRAFT: "neutral",
  PENDING_PAYMENT: "warning",
  PENDING_CONFIRMATIONS: "info",
  SUBMITTED: "info",
  UNDER_REVIEW: "info",
  ACTION_REQUIRED: "warning",
  FURTHER_ASSESSMENT: "info",
  PENDING_DECISION: "info",
  APPROVED: "good",
  APPROVED_WITH_CONDITIONS: "good",
  DEFERRED: "warning",
  REJECTED: "critical",
  LICENSE_ISSUED: "good",
  WITHDRAWN: "neutral",
  EXPIRED_DRAFT: "neutral",
};

export const LICENSE_STATUS_TONES: Record<LicenseStatus, StatusTone> = {
  ACTIVE: "good",
  EXPIRED: "warning",
  LAPSED: "critical",
  SUSPENDED: "critical",
  REVOKED: "critical",
  SURRENDERED: "neutral",
  SUPERSEDED: "neutral",
};

export const CONFIRMATION_STATUS_TONES: Record<ConfirmationStatus, StatusTone> = {
  PENDING: "warning",
  CONFIRMED: "good",
  DECLINED: "critical",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
};

/**
 * The applicant-facing journey (FR-PORTAL-002): the five milestones every application passes,
 * used by compact progress graphics. Returns the index of the milestone a status sits at.
 */
export const JOURNEY_STAGES = ["draft", "payment", "confirmation", "review", "decision"] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export function journeyStageIndex(status: ApplicationStatus): number {
  switch (status) {
    case "DRAFT":
    case "EXPIRED_DRAFT":
    case "WITHDRAWN":
      return 0;
    case "PENDING_PAYMENT":
      return 1;
    case "PENDING_CONFIRMATIONS":
      return 2;
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "ACTION_REQUIRED":
    case "FURTHER_ASSESSMENT":
      return 3;
    default:
      return 4;
  }
}
