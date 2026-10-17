import { z } from "zod";
import { CATEGORIES, type ApplicationType, type Category } from "./categories";

/**
 * Fee schedule and calculator (SRS §6.10 FR-PAY-001/002/009, BR-080). The schedule is
 * configuration: versioned with effective dates and changed through maker-checker. Amounts below
 * are SAMPLE values (Plan §4 P3) until Finance supplies the gazetted schedule.
 */
export const CURRENCY = "RWF";

export const feeScheduleSchema = z.object({
  reference: z.string().trim().min(1).max(120),
  sample: z.boolean(),
  fees: z.record(
    z.enum(CATEGORIES),
    z.object({
      registration: z.number().int().min(0).max(10_000_000),
      licensing: z.number().int().min(0).max(10_000_000),
    }),
  ),
  /** Late renewal within the grace period (BR-040), as a percentage of the licensing fee. */
  latePenaltyPercent: z.number().int().min(0).max(200),
});
export type FeeSchedule = z.infer<typeof feeScheduleSchema>;

export const DEFAULT_FEE_SCHEDULE: FeeSchedule = {
  reference: "SAMPLE schedule — awaiting Finance (Plan P3)",
  sample: true,
  fees: {
    RERA: { registration: 10_000, licensing: 20_000 },
    FSLA: { registration: 15_000, licensing: 30_000 },
    REA: { registration: 20_000, licensing: 50_000 },
    BROKER: { registration: 30_000, licensing: 100_000 },
    ASSOCIATE_BROKER: { registration: 10_000, licensing: 50_000 },
    MANAGING_BROKER: { registration: 15_000, licensing: 75_000 },
    PRINCIPAL_BROKER: { registration: 20_000, licensing: 100_000 },
    REBF: { registration: 50_000, licensing: 200_000 },
  },
  latePenaltyPercent: 25,
};

export type FeeCode = "registration" | "licensing" | "renewal" | "latePenalty";

export interface FeeLine {
  code: FeeCode;
  amount: number;
}

export interface FeeQuote {
  currency: typeof CURRENCY;
  lines: FeeLine[];
  total: number;
  reference: string;
  sample: boolean;
}

/** Category × application type × timing → itemised fees (FR-PAY-001/002). */
export function calculateFees(
  schedule: FeeSchedule,
  { category, type, late = false }: { category: Category; type: ApplicationType; late?: boolean },
): FeeQuote {
  const fee = schedule.fees[category];
  const lines: FeeLine[] = [];
  if (type === "RENEWAL") {
    lines.push({ code: "renewal", amount: fee.licensing });
    if (late)
      lines.push({
        code: "latePenalty",
        amount: Math.round((fee.licensing * schedule.latePenaltyPercent) / 100),
      });
  } else {
    lines.push({ code: "registration", amount: fee.registration });
    lines.push({ code: "licensing", amount: fee.licensing });
  }
  const positive = lines.filter((l) => l.amount > 0);
  return {
    currency: CURRENCY,
    lines: positive,
    total: positive.reduce((sum, l) => sum + l.amount, 0),
    reference: schedule.reference,
    sample: schedule.sample,
  };
}

export const PAYMENT_METHODS = ["MOBILE_MONEY", "CARD", "BANK"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "WAIVED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const startPaymentSchema = z.object({
  applicationId: z.uuid(),
  method: z.enum(PAYMENT_METHODS),
  /** Mobile money only: the wallet to charge (FR-PAY-004). */
  msisdn: z.string().trim().max(20).optional(),
});

export const waiverSchema = z.object({
  applicationId: z.uuid(),
  reason: z.string().trim().min(10, "validation.reasonTooShort").max(500),
});

/** Mock gateway outcomes the sandbox checkout can simulate (FR-PAY-005, INT-023). */
export const GATEWAY_OUTCOMES = ["success", "failure", "delayed"] as const;
export type GatewayOutcome = (typeof GATEWAY_OUTCOMES)[number];

export const PAYMENT_STATUS_TONES = {
  PENDING: "warning",
  PAID: "good",
  FAILED: "critical",
  EXPIRED: "neutral",
  REFUNDED: "neutral",
  WAIVED: "info",
} as const satisfies Record<PaymentStatus, "good" | "warning" | "critical" | "info" | "neutral">;
