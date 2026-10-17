import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

export const revalidate = 3600;

/** FR-B-009: administrative divisions for cascading address selects (public reference data). */
export async function GET(request: NextRequest) {
  const parent = request.nextUrl.searchParams.get("parent");
  const divisions = await db.adminDivision.findMany({
    where: parent ? { parentCode: parent } : { level: 1 },
    orderBy: { name: "asc" },
    select: { code: true, name: true, level: true },
  });
  return NextResponse.json(divisions, { headers: { "Cache-Control": "public, max-age=3600" } });
}
