import { z } from "zod";
import { DEFAULT_FEE_SCHEDULE, feeScheduleSchema } from "./fees";
import type { Capability } from "./roles";
import { DEFAULT_THRESHOLDS, type RuleThresholds } from "./rules";

/**
 * Versioned configuration with maker-checker (FR-ADM-002…004, FR-ELG-002). A change is proposed
 * by a maker (config.edit), approved by a different checker (config.approve), and takes effect at
 * its effective date. Applications keep the version in force when they ran (BR-080, FR-I-006).
 */
export const CONFIG_KEYS = ["fees", "thresholds", "flags"] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

export const CONFIG_STATUSES = ["PENDING", "ACTIVE", "SUPERSEDED", "REJECTED"] as const;
export type ConfigStatus = (typeof CONFIG_STATUSES)[number];

export const thresholdsSchema = z.object({
  minAge: z.number().int().min(16).max(25),
  reaExperienceMonths: z.number().int().min(0).max(120),
  brokerExperienceMonths: z.number().int().min(0).max(120),
  examValidityYears: z.number().int().min(1).max(10),
  criminalRecordMonths: z.number().int().min(1).max(24),
  renewalWindowDays: z.number().int().min(14).max(180),
  graceDays: z.number().int().min(0).max(180),
  licenceValidityYears: z.number().int().min(1).max(5),
  brokerExpiryWarningDays: z.number().int().min(0).max(180),
  reraCountsForRea: z.boolean(),
}) satisfies z.ZodType<RuleThresholds>;

export const flagsSchema = z.object({
  /** FR-B-006: gender captured only where the framework requires it. */
  genderField: z.boolean(),
  /** FR-REG-003: photo on the public register (default off). */
  publicPhoto: z.boolean(),
  /** G7.5 / G8.17: indemnity insurance required. */
  indemnityRequired: z.boolean(),
  /** FR-BO-002: round-robin auto-assignment on submission. */
  autoAssign: z.boolean(),
});
export type FeatureFlags = z.infer<typeof flagsSchema>;

export const DEFAULT_FLAGS: FeatureFlags = {
  genderField: false,
  publicPhoto: false,
  indemnityRequired: true,
  autoAssign: true,
};

export const CONFIG_SCHEMAS = {
  fees: feeScheduleSchema,
  thresholds: thresholdsSchema,
  flags: flagsSchema,
} as const;

export const CONFIG_DEFAULTS = {
  fees: DEFAULT_FEE_SCHEDULE,
  thresholds: DEFAULT_THRESHOLDS,
  flags: DEFAULT_FLAGS,
} as const;

export type ConfigValue<K extends ConfigKey> = z.infer<(typeof CONFIG_SCHEMAS)[K]>;

export const proposeConfigSchema = z.discriminatedUnion("key", [
  z.object({
    key: z.literal("fees"),
    value: feeScheduleSchema,
    effectiveFrom: z.iso.date(),
    reason: z.string().trim().min(10, "validation.reasonTooShort").max(500),
  }),
  z.object({
    key: z.literal("thresholds"),
    value: thresholdsSchema,
    effectiveFrom: z.iso.date(),
    reason: z.string().trim().min(10, "validation.reasonTooShort").max(500),
  }),
  z.object({
    key: z.literal("flags"),
    value: flagsSchema,
    effectiveFrom: z.iso.date(),
    reason: z.string().trim().min(10, "validation.reasonTooShort").max(500),
  }),
]);
export type ProposeConfigInput = z.infer<typeof proposeConfigSchema>;

export const decideConfigSchema = z.object({
  id: z.uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Who may be the maker for each key (FR-ADM-003, Appendix D): config.edit plus one of the area
 * capabilities below. Finance makes fee schedules; system administrators (roles.manage) make
 * everything. Capabilities, not role names, so a matrix edit is honoured everywhere.
 */
export const CONFIG_MAKER_SCOPE: Record<ConfigKey, readonly Capability[]> = {
  fees: ["payments.manage", "roles.manage"],
  thresholds: ["roles.manage"],
  flags: ["roles.manage"],
};

export function mayProposeConfig(key: ConfigKey, capabilities: readonly Capability[]): boolean {
  return (
    capabilities.includes("config.edit") &&
    CONFIG_MAKER_SCOPE[key].some((c) => capabilities.includes(c))
  );
}
