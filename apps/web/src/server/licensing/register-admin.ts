import "server-only";
import {
  CHECKED_REGISTER_ACTIONS,
  SUPERVISED_CATEGORIES,
  type LicenseStatus,
  type RegisterAction,
  type RegisterActionInput,
} from "@rebp/contracts";
import type { Licence, User } from "@/generated/prisma/client";
import { userCan } from "../access/permissions";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { db } from "../db";
import { AppError } from "../errors";
import { notify } from "../notifications/inbox";
import { dateOf, todayKigali } from "../time";
import { projectLicence } from "./register";

/**
 * Register administration (WP-4.4, FR-RA-001/002, FR-WF-010/011, BR-050). Every change writes a
 * licence event and refreshes the public projection in the same transaction, so the public
 * register reflects it immediately (≤ 5 minutes required). Revocation is maker-checker: the
 * Registrar proposes, an Approving Authority (register.revoke) applies.
 */

const NEXT_STATUS: Record<
  Exclude<RegisterAction, "CORRECT">,
  { from: readonly LicenseStatus[]; to: LicenseStatus }
> = {
  SUSPEND: { from: ["ACTIVE"], to: "SUSPENDED" },
  LIFT: { from: ["SUSPENDED"], to: "ACTIVE" },
  REVOKE: { from: ["ACTIVE", "SUSPENDED", "EXPIRED"], to: "REVOKED" },
  SURRENDER: { from: ["ACTIVE", "SUSPENDED", "EXPIRED"], to: "SURRENDERED" },
};

export async function proposeRegisterAction(
  input: RegisterActionInput,
  maker: User,
  ctx: RequestContext,
) {
  const licence = await db.licence.findUnique({ where: { id: input.licenceId } });
  if (!licence) throw new AppError("notFound");
  if (input.action !== "CORRECT" && !NEXT_STATUS[input.action].from.includes(licence.status))
    throw new AppError("invalidTransition");
  const pending = await db.registerAction.count({
    where: { licenceId: licence.id, status: "PENDING" },
  });
  if (pending > 0) throw new AppError("registerActionPending");

  const payload = {
    startsOn: input.startsOn || null,
    endsOn: input.endsOn || null,
    displayName: input.displayName ?? null,
  };
  const action = await db.registerAction.create({
    data: {
      licenceId: licence.id,
      action: input.action,
      payload,
      reason: input.reason,
      reference: input.reference,
      makerId: maker.id,
    },
  });
  await recordAudit({
    action: "register.action_proposed",
    entityType: "Licence",
    entityId: licence.id,
    actorId: maker.id,
    metadata: { licenceNo: licence.licenceNo, action: input.action, reference: input.reference },
    ...ctx,
  });
  if (!CHECKED_REGISTER_ACTIONS.includes(input.action)) {
    await applyRegisterAction(action.id, maker, ctx);
    return { applied: true };
  }
  return { applied: false };
}

export async function decideRegisterAction(
  id: string,
  approve: boolean,
  note: string | undefined,
  checker: User,
  ctx: RequestContext,
) {
  const action = await db.registerAction.findUnique({ where: { id } });
  if (!action || action.status !== "PENDING") throw new AppError("notFound");
  if (action.makerId === checker.id) throw new AppError("makerChecker");
  if (!(await userCan(checker, "register.revoke"))) throw new AppError("forbidden");
  if (!approve) {
    await db.registerAction.update({
      where: { id },
      data: { status: "REJECTED", checkerId: checker.id, note, decidedAt: new Date() },
    });
    await recordAudit({
      action: "register.action_rejected",
      entityType: "Licence",
      entityId: action.licenceId,
      actorId: checker.id,
      metadata: { action: action.action },
      ...ctx,
    });
    return;
  }
  await db.registerAction.update({ where: { id }, data: { checkerId: checker.id, note } });
  await applyRegisterAction(id, checker, ctx);
}

async function applyRegisterAction(id: string, actor: User, ctx: RequestContext) {
  const action = await db.registerAction.findUniqueOrThrow({
    where: { id },
    include: { licence: true },
  });
  const licence = action.licence;
  const payload = action.payload as {
    startsOn: string | null;
    endsOn: string | null;
    displayName: string | null;
  };
  const kind = action.action as RegisterAction;
  let updated: Licence;
  await db.$transaction(async (tx) => {
    if (kind === "CORRECT") {
      updated = await tx.licence.update({
        where: { id: licence.id },
        data: { displayName: payload.displayName ?? licence.displayName },
      });
      await tx.licenceEvent.create({
        data: {
          licenceId: licence.id,
          fromStatus: licence.status,
          toStatus: licence.status,
          action: "CORRECTED",
          reason: action.reason,
          reference: action.reference,
          actorId: actor.id,
        },
      });
    } else {
      const { to } = NEXT_STATUS[kind];
      const { count } = await tx.licence.updateMany({
        where: { id: licence.id, status: licence.status },
        data: { status: to },
      });
      if (count === 0) throw new AppError("staleState");
      updated = { ...licence, status: to };
      await tx.licenceEvent.create({
        data: {
          licenceId: licence.id,
          fromStatus: licence.status,
          toStatus: to,
          action: kind,
          reason: action.reason,
          reference: action.reference,
          startsOn: payload.startsOn
            ? dateOf(payload.startsOn)
            : kind === "SUSPEND"
              ? dateOf(todayKigali())
              : null,
          endsOn: payload.endsOn ? dateOf(payload.endsOn) : null,
          actorId: actor.id,
        },
      });
      if (licence.category === "REBF" && licence.firmId)
        await tx.firm.update({
          where: { id: licence.firmId },
          data: { status: to === "ACTIVE" ? "ACTIVE" : to },
        });
    }
    await projectLicence(licence.id, tx);
    await tx.registerAction.update({
      where: { id },
      data: { status: "APPLIED", decidedAt: new Date() },
    });
  });
  await recordAudit({
    action: `register.${kind.toLowerCase()}`,
    entityType: "Licence",
    entityId: licence.id,
    actorId: actor.id,
    metadata: {
      licenceNo: licence.licenceNo,
      reference: action.reference,
      from: licence.status,
      to: updated!.status,
    },
    ...ctx,
  });
  if (licence.holderId && kind !== "CORRECT")
    await notify(licence.holderId, {
      code: "N-082",
      messageKey: `licence${kind.charAt(0)}${kind.slice(1).toLowerCase()}`,
      values: { licence: licence.licenceNo },
      href: `/licenses/${licence.id}`,
      email: true,
      sms: true,
    });
  if (["SUSPEND", "REVOKE", "SURRENDER"].includes(kind)) await flagSupervisees(licence.id);
}

/** FR-WF-011 / BR-050: supervisees of a licence that stopped being active must name a new supervisor. */
export async function flagSupervisees(supervisorLicenceId: string) {
  const supervisees = await db.licence.findMany({
    where: {
      supervisorLicenceId,
      status: "ACTIVE",
      category: { in: SUPERVISED_CATEGORIES },
      NOT: { flags: { has: "SUPERVISION_REQUIRED" } },
    },
  });
  for (const s of supervisees) {
    await db.licence.update({
      where: { id: s.id },
      data: { flags: { push: "SUPERVISION_REQUIRED" } },
    });
    if (s.holderId)
      await notify(s.holderId, {
        code: "N-080",
        messageKey: "supervisionRequired",
        values: { licence: s.licenceNo },
        href: `/licenses/${s.id}`,
        email: true,
        sms: true,
      });
  }
  return supervisees.length;
}

export async function pendingRegisterActions() {
  return db.registerAction.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      licence: { select: { licenceNo: true, displayName: true, category: true, status: true } },
    },
  });
}
