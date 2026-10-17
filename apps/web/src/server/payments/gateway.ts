import "server-only";
import { createHmac, hkdfSync } from "node:crypto";
import { z } from "zod";
import { PAYMENT_METHODS, type GatewayOutcome, type PaymentMethod } from "@rebp/contracts";
import { safeEqual } from "../auth/crypto";
import { env } from "../env";

/**
 * Payment gateway adapter (ADR-005, INT-010, INT-023). The pilot ships a sandbox ("mock") gateway:
 * its hosted checkout is simulated inside the portal and it reports outcomes through the same
 * signed webhook a real aggregator would use, so swapping providers changes only this module.
 */
export interface GatewayEvent {
  /** Unique per event: replays are ignored (FR-PAY-005). */
  id: string;
  type: "payment.succeeded" | "payment.failed";
  reference: string;
  amount: number;
  currency: string;
  transactionId: string;
  method: PaymentMethod | "WAIVER";
  reason?: string;
  occurredAt: string;
}

/** The webhook payload contract (security review L3). */
export const gatewayEventSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(["payment.succeeded", "payment.failed"]),
  reference: z.string().min(1).max(40),
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  transactionId: z.string().min(1).max(100),
  method: z.enum([...PAYMENT_METHODS, "WAIVER"]),
  reason: z.string().max(200).optional(),
  occurredAt: z.iso.datetime(),
});

export interface PaymentGateway {
  name: string;
  /** Where to send the payer to complete the payment. */
  checkoutUrl(reference: string): string;
  /** Signature header value for a raw webhook body. */
  sign(rawBody: string): string;
  verify(rawBody: string, signature: string | null): boolean;
}

function webhookSecret(): string {
  return (
    env().PAYMENT_WEBHOOK_SECRET ??
    Buffer.from(hkdfSync("sha256", env().AUTH_SECRET, "rebp-payments", "webhook-v1", 32)).toString(
      "hex",
    )
  );
}

export const WEBHOOK_SIGNATURE_HEADER = "x-rebp-signature";

const mockGateway: PaymentGateway = {
  name: "mock",
  checkoutUrl: (reference) => `/pay/${encodeURIComponent(reference)}`,
  sign: (rawBody) =>
    `sha256=${createHmac("sha256", webhookSecret()).update(rawBody).digest("hex")}`,
  verify(rawBody, signature) {
    if (!signature) return false;
    return safeEqual(this.sign(rawBody), signature);
  },
};

export const gateway: PaymentGateway = mockGateway;

/** Sandbox only: the event the mock gateway would send for a simulated outcome. */
export function simulatedEvent(
  outcome: Exclude<GatewayOutcome, "delayed">,
  payment: { reference: string; amount: number; currency: string },
  method: PaymentMethod | "WAIVER",
  eventId: string,
): GatewayEvent {
  return {
    id: eventId,
    type: outcome === "success" ? "payment.succeeded" : "payment.failed",
    reference: payment.reference,
    amount: payment.amount,
    currency: payment.currency,
    transactionId: `MOCK-${eventId.slice(-12).toUpperCase()}`,
    method,
    reason: outcome === "failure" ? "declinedByPayer" : undefined,
    occurredAt: new Date().toISOString(),
  };
}
