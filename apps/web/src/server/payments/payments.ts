import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import {
  calculateFees,
  normalisePhone,
  type FeeLine,
  type GatewayOutcome,
  type PaymentMethod,
} from "@rebp/contracts";
import type { Payment, User } from "@/generated/prisma/client";
import { nextSequence } from "../applications/numbers";
import { ownApplication } from "../applications/applications";
import { proceedAfterPayment } from "../applications/submission";
import { recordAudit } from "../audit/audit";
import { appEnv, env } from "../env";
import type { RequestContext } from "../auth/types";
import { getConfig } from "../config/config";
import { db } from "../db";
import { AppError } from "../errors";
import { notify } from "../notifications/inbox";
import { gatewayEventSchema, gateway, simulatedEvent, type GatewayEvent } from "./gateway";

/**
 * Fees and payments (WP-2.5, FR-PAY-001…011). Each attempt gets a unique reference; the gateway
 * reports through signed webhooks processed idempotently; a second successful payment for the same
 * application is flagged as a duplicate for refund (FR-PAY-011).
 */

export async function feeQuote(app: {
  category: Parameters<typeof calculateFees>[1]["category"];
  type: Parameters<typeof calculateFees>[1]["type"];
  lateRenewal: boolean;
}) {
  const fees = await getConfig("fees");
  return {
    ...calculateFees(fees.value, { category: app.category, type: app.type, late: app.lateRenewal }),
    version: fees.version,
  };
}

export async function startPayment(
  applicationId: string,
  method: PaymentMethod,
  msisdn: string | undefined,
  user: User,
  ctx: RequestContext,
) {
  const app = await ownApplication(applicationId, user);
  if (app.status !== "PENDING_PAYMENT") throw new AppError("invalidTransition");
  const wallet = method === "MOBILE_MONEY" ? normalisePhone(msisdn ?? user.phone ?? "") : null;
  if (method === "MOBILE_MONEY" && !/^\+[1-9]\d{7,14}$/.test(wallet ?? ""))
    throw new AppError("validation", "errors.validation", { msisdn: "validation.phoneInvalid" });

  // BR-080: the schedule in force when payment starts.
  const quote = await feeQuote(app);
  const reference = `PAY-${randomBytes(6).toString("hex").toUpperCase()}`;
  const payment = await db.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { applicationId: app.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    return tx.payment.create({
      data: {
        applicationId: app.id,
        reference,
        amount: quote.total,
        currency: quote.currency,
        lines: quote.lines as unknown as object,
        feeVersion: quote.version,
        method,
        msisdn: wallet,
        provider: gateway.name,
        payerId: user.id,
      },
    });
  });
  await recordAudit({
    action: "payment.started",
    entityType: "Payment",
    entityId: payment.id,
    actorId: user.id,
    metadata: { reference: app.referenceNo, payment: reference, amount: quote.total, method },
    ...ctx,
  });
  return { reference, redirect: gateway.checkoutUrl(reference) };
}

async function receiptNumber() {
  return `RCT-${new Date().getUTCFullYear()}-${String(await nextSequence("receipt_seq")).padStart(6, "0")}`;
}

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

/** Applies a gateway event. Safe to replay: the event id is recorded once (FR-PAY-005). */
export async function applyGatewayEvent(event: GatewayEvent): Promise<WebhookOutcome> {
  const payment = await db.payment.findUnique({ where: { reference: event.reference } });
  try {
    await db.paymentEvent.create({
      data: {
        eventId: event.id,
        paymentId: payment?.id ?? null,
        type: event.type,
        payload: event as unknown as object,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return "duplicate";
    throw error;
  }
  if (!payment) return "ignored";

  if (event.type === "payment.failed") {
    const { count } = await db.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: "FAILED",
        failureReason: event.reason ?? "failed",
        providerTxnId: event.transactionId,
      },
    });
    if (count > 0) {
      await recordAudit({
        action: "payment.failed",
        entityType: "Payment",
        entityId: payment.id,
        actorId: null,
        metadata: { payment: payment.reference },
      });
      await notify(payment.payerId, {
        code: "N-010",
        messageKey: "paymentFailed",
        values: { reference: payment.reference },
        href: `/applications/${payment.applicationId}`,
        email: true,
      });
    }
    return "processed";
  }

  if (event.amount !== payment.amount || event.currency !== payment.currency) {
    // Amount mismatch is an exception for reconciliation, never silently accepted (FR-PAY-010).
    await recordAudit({
      action: "payment.amount_mismatch",
      entityType: "Payment",
      entityId: payment.id,
      actorId: null,
      metadata: { payment: payment.reference, expected: payment.amount, received: event.amount },
    });
    return "ignored";
  }

  const alreadyPaid = await db.payment.count({
    where: {
      applicationId: payment.applicationId,
      status: { in: ["PAID", "WAIVED"] },
      id: { not: payment.id },
    },
  });
  const receiptNo = await receiptNumber();
  const { count } = await db.payment.updateMany({
    where: { id: payment.id, status: { in: ["PENDING", "EXPIRED", "FAILED"] } },
    data: {
      status: "PAID",
      paidAt: new Date(event.occurredAt),
      providerTxnId: event.transactionId,
      receiptNo,
      duplicate: alreadyPaid > 0,
    },
  });
  if (count === 0) return "processed";
  await recordAudit({
    action: alreadyPaid > 0 ? "payment.duplicate" : "payment.paid",
    entityType: "Payment",
    entityId: payment.id,
    actorId: null,
    metadata: { payment: payment.reference, receiptNo, amount: payment.amount },
  });
  await notify(payment.payerId, {
    code: "N-010",
    messageKey: "paymentReceived",
    values: { reference: payment.reference, receipt: receiptNo, amount: payment.amount },
    href: `/applications/${payment.applicationId}`,
    email: true,
    sms: true,
  });
  if (alreadyPaid === 0) await proceedAfterPayment(payment.applicationId, null);
  return "processed";
}

/** Webhook entry point: verify the signature, then apply. */
export async function processWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookOutcome> {
  if (!gateway.verify(rawBody, signature)) throw new AppError("invalidSignature");
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new AppError("validation");
  }
  // L3: only well-formed events of known types are applied (and recorded).
  const result = gatewayEventSchema.safeParse(parsed);
  if (!result.success) throw new AppError("validation");
  const event: GatewayEvent = result.data;
  return applyGatewayEvent(event);
}

/**
 * Sandbox checkout (mock gateway). Success and failure deliver a signed webhook immediately;
 * "delayed" schedules it, and reconciliation polling delivers it later (FR-PAY-005).
 */
/** The sandbox checkout exists only for the mock gateway, never in production (security review H1). */
export function sandboxEnabled() {
  return appEnv() !== "production" && env().PAYMENT_PROVIDER === "mock";
}

export async function simulateCheckout(reference: string, outcome: GatewayOutcome, user: User) {
  if (!sandboxEnabled()) throw new AppError("forbidden");
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment || payment.payerId !== user.id) throw new AppError("notFound");
  if (payment.status !== "PENDING") return payment.status;
  if (outcome === "delayed") {
    await db.paymentEvent
      .create({
        data: {
          eventId: `scheduled:${payment.id}`,
          paymentId: payment.id,
          type: "mock.scheduled",
          payload: { deliverAt: new Date(Date.now() + 8_000).toISOString() },
        },
      })
      .catch(() => undefined);
    return "PENDING";
  }
  const event = simulatedEvent(outcome, payment, payment.method ?? "CARD", `evt_${randomUUID()}`);
  const body = JSON.stringify(event);
  await processWebhook(body, gateway.sign(body));
  return (await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status;
}

/** Reconciliation polling: delivers due sandbox events and expires stale attempts (FR-PAY-005/010). */
export async function reconcilePayments(now = new Date()) {
  const scheduled = await db.paymentEvent.findMany({
    where: { type: "mock.scheduled" },
    include: { payment: true },
  });
  let delivered = 0;
  for (const item of sandboxEnabled() ? scheduled : []) {
    const deliverAt = new Date((item.payload as { deliverAt: string }).deliverAt);
    if (!item.payment || deliverAt > now) continue;
    if (item.payment.status === "PENDING") {
      const event = simulatedEvent(
        "success",
        item.payment,
        item.payment.method ?? "MOBILE_MONEY",
        `evt_${randomUUID()}`,
      );
      const body = JSON.stringify(event);
      await processWebhook(body, gateway.sign(body));
      delivered++;
    }
    await db.paymentEvent.update({ where: { id: item.id }, data: { type: "mock.delivered" } });
  }
  const stale = await db.payment.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 24 * 3_600_000) } },
    data: { status: "EXPIRED" },
  });
  return { delivered, expired: stale.count };
}

/** FR-PAY-008: Finance waives the fee of an application awaiting payment, with a reason. */
export async function waiveFee(
  applicationId: string,
  reason: string,
  officer: User,
  ctx: RequestContext,
) {
  const app = await db.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new AppError("notFound");
  if (app.status !== "PENDING_PAYMENT") throw new AppError("invalidTransition");
  if (app.applicantId === officer.id) throw new AppError("conflictOfInterest");
  // M5: the same conflict-of-interest rule as review (BR-093): supervisor, firm member, declared.
  const { conflictsFor } = await import("../backoffice/assignment");
  if ((await conflictsFor(applicationId, officer.id)).length > 0)
    throw new AppError("conflictOfInterest");
  const quote = await feeQuote(app);
  const payment = await db.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { applicationId, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    return tx.payment.create({
      data: {
        applicationId,
        reference: `WVR-${randomBytes(6).toString("hex").toUpperCase()}`,
        amount: quote.total,
        currency: quote.currency,
        lines: quote.lines as unknown as object,
        feeVersion: quote.version,
        method: "WAIVER",
        status: "WAIVED",
        provider: "finance",
        payerId: app.applicantId,
        waivedById: officer.id,
        waiverReason: reason,
        paidAt: new Date(),
      },
    });
  });
  await recordAudit({
    action: "payment.waived",
    entityType: "Payment",
    entityId: payment.id,
    actorId: officer.id,
    metadata: { reference: app.referenceNo, amount: quote.total, reason },
    ...ctx,
  });
  await proceedAfterPayment(applicationId, officer.id);
}

export function paymentLines(payment: Pick<Payment, "lines">): FeeLine[] {
  return (payment.lines as unknown as FeeLine[]) ?? [];
}
