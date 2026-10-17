import "server-only";
import type { RegisterQuery } from "@rebp/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { exactNumberIds } from "./register";

/** Up to this many names are previewed per district on the map. */
const PREVIEW = 4;

/**
 * FR-REG-002 map view: the current search grouped by district (public fields only, FR-REG-003).
 * The district filter itself is ignored so the map always shows every district, with the
 * chosen one highlighted. Each district gets a total, how many are valid, and a short preview.
 */
export async function registerByDistrict(query: RegisterQuery) {
  const where: Prisma.RegisterEntryWhereInput = {
    status: query.status ?? { notIn: ["SUPERSEDED"] },
    ...(query.category ? { category: query.category } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
  };
  const q = query.q?.trim().toLowerCase();
  const exact = q ? await exactNumberIds(q) : null;
  if (exact) where.licenceId = { in: exact };
  else if (q) {
    const ids = await db.$queryRaw<Array<{ licenceId: string }>>`
      SELECT "licenceId" FROM "RegisterEntry"
      WHERE "searchText" ILIKE ${`%${q}%`} OR word_similarity(${q}, "searchText") > 0.35
      LIMIT 500`;
    where.licenceId = { in: ids.map((r) => r.licenceId) };
  }
  const rows = await db.registerEntry.findMany({
    where: { ...where, district: { not: null } },
    orderBy: { displayName: "asc" },
    select: {
      district: true,
      status: true,
      displayName: true,
      category: true,
      kind: true,
      licenceNo: true,
    },
    take: 2000,
  });
  const byDistrict = new Map<
    string,
    { code: string; total: number; valid: number; firms: number; preview: typeof rows }
  >();
  for (const row of rows) {
    const code = row.district!;
    const group = byDistrict.get(code) ?? { code, total: 0, valid: 0, firms: 0, preview: [] };
    group.total += 1;
    if (row.status === "ACTIVE") group.valid += 1;
    if (row.kind === "FIRM") group.firms += 1;
    if (group.preview.length < PREVIEW) group.preview.push(row);
    byDistrict.set(code, group);
  }
  return [...byDistrict.values()];
}
