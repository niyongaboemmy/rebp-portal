import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "@/server/action";
import { errorResponse } from "@/server/http";
import { toPublicEntries } from "@/server/licensing/public-entry";
import { searchRegister } from "@/server/licensing/register";

export const dynamic = "force-dynamic";

/**
 * FR-REG-002: live search suggestions for the register (public fields only, FR-REG-003). Each
 * call spends the anonymous anti-scraping budget like a full search (FR-REG-005).
 */
export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 2) return NextResponse.json([]);
    await enforceRateLimit("registerSearch");
    const result = await searchRegister({ q });
    return NextResponse.json(await toPublicEntries(result.entries.slice(0, 6)));
  } catch (error) {
    return errorResponse(error);
  }
}
