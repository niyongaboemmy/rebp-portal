import "server-only";
import { cache } from "react";
import { db } from "../db";
import { findRegisterEntry } from "./register";
import { certificateSeal } from "./official-documents";

/**
 * Read models for the public register and the verification page (FR-REG-001…005/008).
 * Everything returned here is public (FR-REG-003): names, numbers, categories, places,
 * statuses and dates — never reasons, references, contact details or identity numbers.
 */

/** Districts (AdminDivision level 2) for the register filter, by name. */
/** Districts with their province, for the grouped district filter (FR-REG-002). */
export const listDistricts = cache(async () => {
  const [provinces, districts] = await Promise.all([
    db.adminDivision.findMany({ where: { level: 1 }, select: { code: true, name: true } }),
    db.adminDivision.findMany({
      where: { level: 2 },
      orderBy: { name: "asc" },
      select: { code: true, name: true, parentCode: true },
    }),
  ]);
  const province = new Map(provinces.map((p) => [p.code, p.name]));
  return districts.map((d) => ({
    code: d.code,
    name: d.name,
    province: (d.parentCode && province.get(d.parentCode)) ?? "",
  }));
});

/** Display names for admin-division codes (district, scope). */
export async function divisionNames(codes: readonly string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(codes.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const rows = await db.adminDivision.findMany({
    where: { code: { in: unique } },
    select: { code: true, name: true },
  });
  return new Map(rows.map((r) => [r.code, r.name]));
}

/** Public status history: what happened and when — no reasons, actors or references. */
export async function publicLicenceHistory(licenceId: string) {
  return db.licenceEvent.findMany({
    where: { licenceId },
    orderBy: { at: "desc" },
    take: 20,
    select: { id: true, action: true, toStatus: true, at: true, startsOn: true, endsOn: true },
  });
}

/**
 * FR-REG-004 / FR-N-012: resolve a QR token or licence number to the public entry, its
 * certificate seal (FR-N-002, tamper evidence), its public history and, for a superseded
 * licence, the number of the licence that replaced it. Cached per request (metadata + page).
 */
export const resolveVerification = cache(async (value: string) => {
  const found = await findRegisterEntry(value);
  if (!found) return null;
  if (!found.entry) return { kind: "replaced" as const, current: found.current };
  const entry = found.entry;
  const [licence, history, names] = await Promise.all([
    db.licence.findUnique({
      where: { id: entry.licenceId },
      select: {
        licenceNo: true,
        displayName: true,
        category: true,
        issuedAt: true,
        expiresAt: true,
        certificateVersion: true,
        qrToken: true,
        supersededById: true,
      },
    }),
    publicLicenceHistory(entry.licenceId),
    divisionNames([...(entry.district ? [entry.district] : []), ...entry.scope]),
  ]);
  const replacement = licence?.supersededById
    ? await db.licence.findUnique({
        where: { id: licence.supersededById },
        select: { licenceNo: true },
      })
    : null;
  return {
    kind: "entry" as const,
    entry,
    seal: licence ? certificateSeal(licence) : null,
    certificateVersion: licence?.certificateVersion ?? 1,
    history,
    names,
    replacedBy: replacement?.licenceNo ?? null,
  };
});

/** The most recently issued valid licences: public "try it" examples on the verify page. */
export async function recentLicences(take = 3) {
  return db.registerEntry.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ issuedAt: "desc" }, { licenceNo: "asc" }],
    take,
    select: { licenceNo: true, displayName: true, category: true, kind: true },
  });
}
