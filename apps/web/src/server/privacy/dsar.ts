import "server-only";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { db } from "../db";

/**
 * FR-DSR-001: a machine-readable copy of the user's personal data. Secrets (password hash, TOTP
 * secret, recovery codes, session ids) are excluded; documents are listed with their hashes
 * (the files themselves are downloadable from each application).
 */
export async function exportPersonalData(userId: string, ctx: RequestContext) {
  const [user, applications, licences, notifications, activity] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        phone: true,
        phoneVerifiedAt: true,
        accountType: true,
        fullName: true,
        locale: true,
        roles: true,
        mfaMethods: true,
        createdAt: true,
        lastSignInAt: true,
      },
    }),
    db.application.findMany({
      where: { applicantId: userId },
      select: {
        referenceNo: true,
        type: true,
        category: true,
        status: true,
        data: true,
        createdAt: true,
        submittedAt: true,
        decidedAt: true,
        events: { select: { fromStatus: true, toStatus: true, at: true, reason: true } },
        documents: {
          where: { removedAt: null },
          select: {
            type: true,
            status: true,
            versions: {
              select: { version: true, fileName: true, sha256: true, size: true, createdAt: true },
            },
          },
        },
        payments: {
          select: {
            reference: true,
            amount: true,
            currency: true,
            status: true,
            receiptNo: true,
            paidAt: true,
          },
        },
        decisions: { select: { decision: true, letterNo: true, signedAt: true, reasons: true } },
      },
    }),
    db.licence.findMany({
      where: { holderId: userId },
      select: {
        licenceNo: true,
        category: true,
        status: true,
        issuedAt: true,
        expiresAt: true,
        scope: true,
        conditions: true,
      },
    }),
    db.notification.findMany({
      where: { userId },
      select: { code: true, messageKey: true, values: true, createdAt: true, readAt: true },
    }),
    db.auditEvent.findMany({
      where: { actorId: userId },
      orderBy: { id: "desc" },
      take: 1000,
      select: {
        occurredAt: true,
        action: true,
        entityType: true,
        ipAddress: true,
        userAgent: true,
      },
    }),
  ]);
  await recordAudit({
    action: "privacy.data_exported",
    entityType: "User",
    entityId: userId,
    actorId: userId,
    ...ctx,
  });
  return {
    exportedAt: new Date().toISOString(),
    format: "REBP-DSAR-1",
    account: user,
    applications,
    licences,
    notifications,
    activity,
  };
}
