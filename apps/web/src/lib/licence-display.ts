/**
 * Display helpers for licence data shared by the register, verification page and wallet.
 * Register conditions are stored as "CODE" or "CODE:text" (FR-REG-003 public projection).
 */
export const CONDITION_CODES = [
  "SUPERVISED_PRACTICE",
  "REFERRAL_ONLY",
  "TERRITORY_LIMITED",
  "REPORT_QUARTERLY",
  "COMPLETE_TRAINING",
  "PROVIDE_INSURANCE",
  "CUSTOM",
] as const;
export type ConditionCode = (typeof CONDITION_CODES)[number];

export function parseCondition(raw: string): { code: ConditionCode; text?: string } {
  const index = raw.indexOf(":");
  const code = index === -1 ? raw : raw.slice(0, index);
  const text = index === -1 ? undefined : raw.slice(index + 1);
  return (CONDITION_CODES as readonly string[]).includes(code)
    ? { code: code as ConditionCode, text }
    : { code: "CUSTOM", text: text ?? raw };
}

/** Licence-event actions with a translated label (verification.events.*). */
export const LICENCE_EVENT_ACTIONS = [
  "ISSUED",
  "RENEWED",
  "CERTIFICATE_REISSUED",
  "SUPERSEDED",
  "EXPIRED",
  "LAPSED",
  "MIGRATED",
  "CORRECTED",
  "AFFILIATION_ENDED",
  "SUSPEND",
  "LIFT",
  "REVOKE",
  "SURRENDER",
] as const;
export type LicenceEventAction = (typeof LICENCE_EVENT_ACTIONS)[number];

export function eventAction(action: string): LicenceEventAction | "other" {
  return (LICENCE_EVENT_ACTIONS as readonly string[]).includes(action)
    ? (action as LicenceEventAction)
    : "other";
}
