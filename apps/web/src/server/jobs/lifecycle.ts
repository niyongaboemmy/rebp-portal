import "server-only";
import { addDays, addMonths, daysBetween } from "@rebp/contracts";
import { recordAudit } from "../audit/audit";
import { auditTransition, transition } from "../applications/applications";
import { getConfig } from "../config/config";
import { processConfirmationTimers } from "../confirmations/confirmations";
import { db } from "../db";
import { retryPendingIssuance } from "../licensing/licensing";
import { flagSupervisees } from "../licensing/register-admin";
import { projectLicence } from "../licensing/register";
import { notify, notifyUsersWithCapability } from "../notifications/inbox";
import { reconcilePayments } from "../payments/payments";
import { addWorkingDays, dayOf, todayKigali } from "../time";

/**
 * Scheduled jobs (WP-4.1 renewal-lite, FR-REN-001…003, FR-NOT-005, FR-WF-004/006, BR-040…042,
 * BR-050). Every job takes `now` so a time-travel test can walk a licence through its life.
 * Reminders are de-duplicated through ReminderLog keys.
 */
export const RENEWAL_REMINDER_DAYS = [90, 60, 30, 14, 7] as const;
const DRAFT_TTL_DAYS = 90;

async function once(key: string, send: () => Promise<void>) {
  try {
    await db.reminderLog.create({ data: { key } });
  } catch {
    return false;
  }
  await send();
  return true;
}

/** Renewal statuses that count as "timely filed" (BR-041). */
const RENEWAL_IN_FLIGHT = [
  "PENDING_PAYMENT",
  "PENDING_CONFIRMATIONS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_DECISION",
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
] as const;

export async function runLicenceLifecycle(now = new Date()) {
  const today = todayKigali(now);
  const t = (await getConfig("thresholds", now)).value;
  const summary = { reminders: 0, expired: 0, keptActive: 0, lapsed: 0, graceReminders: 0 };

  // Reminders before expiry (N-070), to the holder.
  const active = await db.licence.findMany({ where: { status: "ACTIVE" } });
  for (const licence of active) {
    const expires = dayOf(licence.expiresAt);
    const left = daysBetween(today, expires);
    // The tightest bucket that has been reached, e.g. 45 days left → the 60-day reminder.
    const due = RENEWAL_REMINDER_DAYS.filter((d) => left <= d).at(-1);
    if (due && licence.holderId && left > 0) {
      const sent = await once(`renewal-${due}:${licence.id}:${expires}`, () =>
        notify(licence.holderId!, {
          code: "N-070",
          messageKey: "renewalReminder",
          values: { licence: licence.licenceNo, days: left, date: expires },
          href: `/licenses/${licence.id}`,
          email: true,
          sms: due <= 30,
        }),
      );
      if (sent) summary.reminders++;
    }

    // Expiry day passed.
    if (expires < today) {
      const timely = await db.application.count({
        where: {
          type: "RENEWAL",
          relatedLicenceId: licence.id,
          status: { in: [...RENEWAL_IN_FLIGHT] },
          signedAt: { lte: new Date(`${expires}T23:59:59+02:00`) },
        },
      });
      if (timely > 0) {
        // BR-041 / FR-REN-002: a renewal filed in time keeps the licence active until decided.
        if (!licence.flags.includes("RENEWAL_PENDING")) {
          await db.licence.update({
            where: { id: licence.id },
            data: { flags: { push: "RENEWAL_PENDING" } },
          });
          summary.keptActive++;
        }
        continue;
      }
      await db.$transaction(async (tx) => {
        const { count } = await tx.licence.updateMany({
          where: { id: licence.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
        if (count === 0) return;
        await tx.licenceEvent.create({
          data: {
            licenceId: licence.id,
            fromStatus: "ACTIVE",
            toStatus: "EXPIRED",
            action: "EXPIRED",
            startsOn: new Date(`${today}T00:00:00Z`),
          },
        });
        await projectLicence(licence.id, tx);
      });
      await recordAudit({
        action: "licence.expired",
        entityType: "Licence",
        entityId: licence.id,
        actorId: null,
        metadata: { licenceNo: licence.licenceNo },
      });
      if (licence.holderId)
        await notify(licence.holderId, {
          code: "N-070",
          messageKey: "licenceExpired",
          values: { licence: licence.licenceNo, graceDays: t.graceDays },
          href: `/licenses/${licence.id}`,
          email: true,
          sms: true,
        });
      summary.expired++;
    }
  }

  // Grace period: reminders, then LAPSED (BR-042).
  const expired = await db.licence.findMany({ where: { status: "EXPIRED" } });
  for (const licence of expired) {
    const expires = dayOf(licence.expiresAt);
    const graceEnds = addDays(expires, t.graceDays);
    if (today > graceEnds) {
      const timely = await db.application.count({
        where: {
          type: "RENEWAL",
          relatedLicenceId: licence.id,
          status: { in: [...RENEWAL_IN_FLIGHT] },
        },
      });
      if (timely > 0) continue;
      await db.$transaction(async (tx) => {
        const { count } = await tx.licence.updateMany({
          where: { id: licence.id, status: "EXPIRED" },
          data: { status: "LAPSED" },
        });
        if (count === 0) return;
        await tx.licenceEvent.create({
          data: {
            licenceId: licence.id,
            fromStatus: "EXPIRED",
            toStatus: "LAPSED",
            action: "LAPSED",
            startsOn: new Date(`${today}T00:00:00Z`),
          },
        });
        await projectLicence(licence.id, tx);
      });
      await recordAudit({
        action: "licence.lapsed",
        entityType: "Licence",
        entityId: licence.id,
        actorId: null,
        metadata: { licenceNo: licence.licenceNo },
      });
      if (licence.holderId)
        await notify(licence.holderId, {
          code: "N-070",
          messageKey: "licenceLapsed",
          values: { licence: licence.licenceNo },
          href: `/licenses/${licence.id}`,
          email: true,
          sms: true,
        });
      await flagSupervisees(licence.id);
      summary.lapsed++;
    } else if (licence.holderId) {
      const sent = await once(`grace:${licence.id}:${expires}`, () =>
        notify(licence.holderId!, {
          code: "N-070",
          messageKey: "graceReminder",
          values: { licence: licence.licenceNo, date: graceEnds },
          href: `/licenses/${licence.id}`,
          email: true,
        }),
      );
      if (sent) summary.graceReminders++;
    }
  }
  return summary;
}

/** FR-WF-004: drafts idle for 90 days expire; reminders at N−14 and N−3 (N-003). */
export async function runDraftExpiry(now = new Date()) {
  const drafts = await db.application.findMany({ where: { status: "DRAFT" } });
  let expired = 0;
  for (const app of drafts) {
    const idle = Math.floor((now.getTime() - app.lastActivityAt.getTime()) / 86_400_000);
    if (idle >= DRAFT_TTL_DAYS) {
      await db.$transaction((tx) => transition(tx, app, "EXPIRED_DRAFT", { reason: "inactive" }));
      await auditTransition(app, "DRAFT", "EXPIRED_DRAFT", null);
      expired++;
      continue;
    }
    for (const before of [14, 3]) {
      if (idle >= DRAFT_TTL_DAYS - before)
        await once(
          `draft-${before}:${app.id}:${app.lastActivityAt.toISOString().slice(0, 10)}`,
          () =>
            notify(app.applicantId, {
              code: "N-003",
              messageKey: "draftExpiring",
              values: { reference: app.referenceNo, days: DRAFT_TTL_DAYS - idle },
              href: `/applications/${app.id}`,
              email: true,
            }),
        );
    }
  }
  return { expired };
}

/** Working days past the SLA due date after which a breach is escalated to the team lead. */
export const SLA_ESCALATION_WORKING_DAYS = 2;

/**
 * FR-BO-004 / N-031: one SLA breach warning per application per day to its officer; a file still
 * breached more than two working days after its due date is escalated, once, to the team leads
 * (review.assign) — assigned or not.
 */
export async function runSlaWarnings(now = new Date()) {
  const breached = await db.application.findMany({
    where: {
      slaDueAt: { lt: now },
      status: { in: ["SUBMITTED", "UNDER_REVIEW", "FURTHER_ASSESSMENT"] },
    },
    select: { id: true, referenceNo: true, assignedOfficerId: true, slaDueAt: true },
  });
  let warned = 0;
  let escalated = 0;
  for (const app of breached) {
    if (app.assignedOfficerId) {
      const sent = await once(`sla:${app.id}:${todayKigali(now)}`, () =>
        notify(app.assignedOfficerId!, {
          code: "N-031",
          messageKey: "slaBreach",
          values: { reference: app.referenceNo },
          href: `/backoffice/review/${app.id}`,
          email: true,
        }),
      );
      if (sent) warned++;
    }
    if (addWorkingDays(app.slaDueAt!, SLA_ESCALATION_WORKING_DAYS) < now) {
      const sent = await once(`sla-escalated:${app.id}:${app.slaDueAt!.toISOString()}`, () =>
        notifyUsersWithCapability("review.assign", {
          code: "N-031",
          messageKey: "slaEscalated",
          values: { reference: app.referenceNo, date: dayOf(app.slaDueAt!) },
          href: `/backoffice/review/${app.id}`,
          email: true,
        }),
      );
      if (sent) escalated++;
    }
  }
  return { warned, escalated };
}

/**
 * N-041 (UX-032): an open information request two days before it falls due (applicant), and once
 * it is overdue (applicant and the officer who asked). Each is sent once.
 */
export async function runInformationReminders(now = new Date()) {
  const soon = new Date(now.getTime() + 2 * 86_400_000);
  const open = await db.informationRequest.findMany({
    where: { status: "OPEN", dueAt: { lt: soon }, application: { status: "ACTION_REQUIRED" } },
    select: {
      id: true,
      dueAt: true,
      officerId: true,
      application: { select: { id: true, referenceNo: true, applicantId: true } },
    },
  });
  let reminded = 0;
  for (const request of open) {
    const { application: app } = request;
    const overdue = request.dueAt < now;
    const values = { reference: app.referenceNo, due: request.dueAt.toISOString().slice(0, 10) };
    const sent = await once(`info:${request.id}:${overdue ? "overdue" : "soon"}`, async () => {
      await notify(app.applicantId, {
        code: "N-041",
        messageKey: overdue ? "infoOverdue" : "infoReminder",
        values,
        href: `/applications/${app.id}`,
        email: true,
        sms: true,
      });
      if (overdue)
        await notify(request.officerId, {
          code: "N-041",
          messageKey: "infoOverdueOfficer",
          values,
          href: `/backoffice/review/${app.id}`,
        });
    });
    if (sent) reminded++;
  }
  return { reminded };
}

/** N-090: "You can now apply for REA / Broker" when the experience threshold is reached. */
export async function runUpgradeNudges(now = new Date()) {
  const today = todayKigali(now);
  const t = (await getConfig("thresholds", now)).value;
  const ladder = [
    { from: "FSLA" as const, to: "REA", months: t.reaExperienceMonths },
    { from: "REA" as const, to: "BROKER", months: t.brokerExperienceMonths },
  ];
  let sent = 0;
  for (const step of ladder) {
    const licences = await db.licence.findMany({
      where: { category: step.from, status: "ACTIVE" },
    });
    for (const licence of licences) {
      if (!licence.holderId || addMonths(dayOf(licence.issuedAt), step.months) > today) continue;
      if (
        await once(`upgrade:${licence.id}:${step.to}`, () =>
          notify(licence.holderId!, {
            code: "N-090",
            messageKey: "upgradeEligible",
            values: { category: step.to },
            href: "/applications/new",
            email: true,
          }),
        )
      )
        sent++;
    }
  }
  return { sent };
}

/** Everything the scheduler runs (POST /api/jobs/run, or "Run now" in the console). */
export async function runScheduledJobs(now = new Date()) {
  const result = {
    licences: await runLicenceLifecycle(now),
    drafts: await runDraftExpiry(now),
    confirmations: await processConfirmationTimers(now),
    payments: await reconcilePayments(now),
    issuance: await retryPendingIssuance(),
    sla: await runSlaWarnings(now),
    information: await runInformationReminders(now),
    upgrades: await runUpgradeNudges(now),
  };
  // The health panel reads this as the exact last run (FR-ADM-005).
  await recordAudit({
    action: "jobs.run",
    entityType: "System",
    entityId: "scheduler",
    actorId: null,
    metadata: Object.fromEntries(
      Object.entries(result).map(([job, counts]) => [job, counts as Record<string, number>]),
    ),
  });
  return result;
}
