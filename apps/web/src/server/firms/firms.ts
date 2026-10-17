import "server-only";
import type { Category, User } from "@/generated/prisma/client";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { db } from "../db";
import { AppError } from "../errors";
import { notify } from "../notifications/inbox";
import { dateOf } from "../time";
import { projectLicence } from "../licensing/register";

/**
 * Firm workspace (WP-4.2, FR-FIRM-001…005) and the firm/supervisor lookups used by Section F
 * (FR-F-002/004). A user acts for a firm as its owner (organisation account) or as the holder of
 * its active Principal Broker licence.
 */
export async function firmsForUser(userId: string) {
  return db.firm.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { licences: { some: { holderId: userId } } },
        {
          affiliated: {
            some: { holderId: userId, category: "PRINCIPAL_BROKER", status: "ACTIVE" },
          },
        },
      ],
    },
    include: {
      branches: { orderBy: { name: "asc" } },
      registrant: { select: { registrationNo: true } },
    },
    orderBy: { legalName: "asc" },
  });
}

async function assertFirmAccess(firmId: string, user: Pick<User, "id">) {
  const firms = await firmsForUser(user.id);
  if (!firms.some((f) => f.id === firmId)) throw new AppError("notFound");
}

/** FR-FIRM-002: affiliated practitioners with category, status, expiry, supervisor and branch. */
export async function firmRoster(firmId: string, user: Pick<User, "id">) {
  await assertFirmAccess(firmId, user);
  const licences = await db.licence.findMany({
    where: { affiliatedFirmId: firmId, status: { notIn: ["SUPERSEDED"] } },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    include: {
      branch: { select: { name: true } },
      registrant: { select: { registrationNo: true } },
    },
  });
  const supervisorIds = licences
    .map((l) => l.supervisorLicenceId)
    .filter((id): id is string => Boolean(id));
  const supervisors = await db.licence.findMany({
    where: { id: { in: supervisorIds } },
    select: { id: true, displayName: true, licenceNo: true },
  });
  const byId = new Map(supervisors.map((s) => [s.id, s]));
  return licences.map((l) => ({
    ...l,
    supervisor: l.supervisorLicenceId ? (byId.get(l.supervisorLicenceId) ?? null) : null,
  }));
}

/** FR-FIRM-005: the Principal Broker ends an affiliation; BR-050 grace starts for the practitioner. */
export async function endAffiliation(
  licenceId: string,
  effectiveOn: string,
  reason: string,
  user: User,
  ctx: RequestContext,
) {
  const licence = await db.licence.findUnique({ where: { id: licenceId } });
  if (!licence?.affiliatedFirmId || licence.category === "PRINCIPAL_BROKER")
    throw new AppError("notFound");
  await assertFirmAccess(licence.affiliatedFirmId, user);
  if (licence.holderId === user.id) throw new AppError("forbidden");
  await db.$transaction(async (tx) => {
    await tx.affiliation.updateMany({
      where: { licenceId, firmId: licence.affiliatedFirmId!, endsOn: null },
      data: { endsOn: dateOf(effectiveOn), endReason: reason },
    });
    await tx.licence.update({
      where: { id: licenceId },
      data: {
        affiliatedFirmId: null,
        branchId: null,
        flags: Array.from(new Set([...licence.flags, "AFFILIATION_REQUIRED"])),
      },
    });
    await tx.licenceEvent.create({
      data: {
        licenceId,
        fromStatus: licence.status,
        toStatus: licence.status,
        action: "AFFILIATION_ENDED",
        reason,
        endsOn: dateOf(effectiveOn),
        actorId: user.id,
      },
    });
    await projectLicence(licenceId, tx);
  });
  await recordAudit({
    action: "firm.affiliation_ended",
    entityType: "Licence",
    entityId: licenceId,
    actorId: user.id,
    metadata: { licenceNo: licence.licenceNo, effectiveOn },
    ...ctx,
  });
  if (licence.holderId)
    await notify(licence.holderId, {
      code: "N-081",
      messageKey: "affiliationEnded",
      values: { licence: licence.licenceNo, date: effectiveOn },
      href: `/licenses/${licence.id}`,
      email: true,
      sms: true,
    });
}

/** FR-F-002: typeahead over licensed firms (public data only). */
export async function searchFirms(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const firms = await db.firm.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { legalName: { contains: term, mode: "insensitive" } },
        { tradingName: { contains: term, mode: "insensitive" } },
        { companyRegNo: { contains: term, mode: "insensitive" } },
        { registrant: { registrationNo: { contains: term, mode: "insensitive" } } },
      ],
    },
    take: 8,
    include: {
      registrant: { select: { registrationNo: true } },
      branches: {
        where: { status: "ACTIVE" },
        select: { id: true, name: true, managingLicenceId: true },
      },
    },
    orderBy: { legalName: "asc" },
  });
  const principals = await db.licence.findMany({
    where: {
      id: { in: firms.map((f) => f.principalLicenceId).filter((x): x is string => Boolean(x)) },
    },
    select: { id: true, displayName: true, licenceNo: true },
  });
  const byId = new Map(principals.map((p) => [p.id, p]));
  return firms.map((f) => ({
    id: f.id,
    legalName: f.legalName,
    tradingName: f.tradingName,
    registrationNo: f.registrant?.registrationNo ?? f.companyRegNo,
    district: f.district,
    principal: f.principalLicenceId ? (byId.get(f.principalLicenceId) ?? null) : null,
    branches: f.branches.map((b) => ({
      id: b.id,
      name: b.name,
      hasManager: Boolean(b.managingLicenceId),
    })),
  }));
}

export async function firmSummary(firmId: string) {
  const firm = await db.firm.findUnique({
    where: { id: firmId },
    include: {
      registrant: { select: { registrationNo: true } },
      branches: {
        where: { status: "ACTIVE" },
        select: { id: true, name: true, managingLicenceId: true },
      },
    },
  });
  if (!firm) return null;
  const principal = firm.principalLicenceId
    ? await db.licence.findUnique({
        where: { id: firm.principalLicenceId },
        select: { displayName: true, licenceNo: true },
      })
    : null;
  return {
    id: firm.id,
    legalName: firm.legalName,
    tradingName: firm.tradingName,
    registrationNo: firm.registrant?.registrationNo ?? firm.companyRegNo,
    district: firm.district,
    status: firm.status,
    principal,
    branches: firm.branches.map((b) => ({
      id: b.id,
      name: b.name,
      hasManager: Boolean(b.managingLicenceId),
    })),
  };
}

/** FR-F-004: a supervisor lookup by licence number shows only public register fields. */
/**
 * Register search for a licence field (UX-023): by name, firm or part of the number, among active
 * licences of the categories that would satisfy the rule (e.g. those allowed to supervise). Public
 * register fields only, a handful of results.
 */
export async function searchLicences(query: string, categories: readonly Category[] = []) {
  const q = query.trim();
  if (q.length < 2) return [];
  return db.registerEntry.findMany({
    where: {
      status: "ACTIVE",
      ...(categories.length > 0 ? { category: { in: [...categories] } } : {}),
      OR: [
        { searchText: { contains: q, mode: "insensitive" } },
        { licenceNo: { contains: q.replace(/\s+/g, "-"), mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { displayName: "asc" },
    take: 5,
    select: { licenceNo: true, displayName: true, category: true, firmName: true },
  });
}

export async function lookupLicence(licenceNo: string) {
  const entry = await db.registerEntry.findFirst({
    where: { licenceNo: { equals: licenceNo.trim(), mode: "insensitive" } },
    select: {
      licenceNo: true,
      displayName: true,
      category: true,
      status: true,
      firmName: true,
      expiresAt: true,
    },
  });
  return entry;
}
