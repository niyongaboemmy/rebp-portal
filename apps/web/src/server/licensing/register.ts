import "server-only";
import type { RegisterQuery } from "@rebp/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { projectLicenceWith } from "./projection";

/**
 * Public register read model (ADR-006, FR-REG-001…005). Only public fields are projected
 * (FR-REG-003): never ID numbers, dates of birth, home addresses, contact details or Section H.
 * The projection is refreshed in the same transaction as every licence change (FR-WF-010).
 */
type Client = Prisma.TransactionClient | typeof db;

export type { PublicCondition } from "./projection";

export async function projectLicence(licenceId: string, client: Client = db) {
  await projectLicenceWith(client, licenceId);
}

export const REGISTER_PAGE_SIZE = 20;

/**
 * An exact licence or registration number names one entry: return just its id(s), so a number
 * search never fans out to similar-looking numbers through trigram matching. Null otherwise.
 */
export async function exactNumberIds(q: string): Promise<string[] | null> {
  const v = q.trim();
  if (!/^[a-z]{2,4}-(\d{4}-)?\d{4,6}$/i.test(v)) return null;
  const rows = await db.registerEntry.findMany({
    where: {
      OR: [
        { licenceNo: { equals: v, mode: "insensitive" } },
        { registrationNo: { equals: v, mode: "insensitive" } },
      ],
    },
    select: { licenceId: true },
  });
  return rows.length ? rows.map((r) => r.licenceId) : null;
}

/**
 * FR-REG-002: search by name, number, firm, category, district, status; typo tolerant via
 * trigram similarity; paginated. Superseded licences are never listed.
 */
export async function searchRegister(query: RegisterQuery) {
  const page = query.page ?? 1;
  const where: Prisma.RegisterEntryWhereInput = {
    status: query.status ?? { notIn: ["SUPERSEDED"] },
    ...(query.category ? { category: query.category } : {}),
    ...(query.district ? { district: query.district } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
  };
  const q = query.q?.trim().toLowerCase();
  if (!q) {
    const [total, entries] = await Promise.all([
      db.registerEntry.count({ where }),
      db.registerEntry.findMany({
        where,
        orderBy: [{ displayName: "asc" }],
        skip: (page - 1) * REGISTER_PAGE_SIZE,
        take: REGISTER_PAGE_SIZE,
      }),
    ]);
    return { total, entries, page };
  }
  const exact = await exactNumberIds(q);
  if (exact) {
    const entries = await db.registerEntry.findMany({
      where: { ...where, licenceId: { in: exact } },
      orderBy: [{ displayName: "asc" }],
    });
    return { total: entries.length, entries, page: 1 };
  }
  // Exact and substring matches first, then fuzzy matches by trigram similarity.
  const ids = await db.$queryRaw<Array<{ licenceId: string }>>`
    SELECT "licenceId" FROM "RegisterEntry"
    WHERE "searchText" ILIKE ${`%${q}%`} OR word_similarity(${q}, "searchText") > 0.35
    ORDER BY ("searchText" ILIKE ${`%${q}%`}) DESC, word_similarity(${q}, "searchText") DESC
    LIMIT 500`;
  const matched = ids.map((r) => r.licenceId);
  const filtered = await db.registerEntry.findMany({
    where: { ...where, licenceId: { in: matched } },
  });
  const order = new Map(matched.map((id, i) => [id, i]));
  filtered.sort((a, b) => order.get(a.licenceId)! - order.get(b.licenceId)!);
  return {
    total: filtered.length,
    entries: filtered.slice((page - 1) * REGISTER_PAGE_SIZE, page * REGISTER_PAGE_SIZE),
    page,
  };
}

/** FR-REG-004: the verification page resolves a QR token or a licence number. */
export async function findRegisterEntry(value: string) {
  const v = value.trim();
  const entry =
    (await db.registerEntry.findUnique({ where: { qrToken: v } })) ??
    (await db.registerEntry.findFirst({
      where: { licenceNo: { equals: v, mode: "insensitive" } },
    }));
  if (entry) return { entry, superseded: false as const };
  // A reissued certificate's old QR shows "superseded, see current" (FR-N-012).
  const old = await db.licenceEvent.findFirst({
    where: { action: "CERTIFICATE_REISSUED", reference: v },
    select: { licence: { select: { licenceNo: true } } },
  });
  return old ? { entry: null, superseded: true as const, current: old.licence.licenceNo } : null;
}

export async function registerStats() {
  const grouped = await db.registerEntry.groupBy({
    by: ["category", "status"],
    _count: { _all: true },
  });
  return grouped.map((g) => ({ category: g.category, status: g.status, count: g._count._all }));
}
