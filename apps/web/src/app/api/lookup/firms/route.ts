import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "@/server/action";
import { searchFirms } from "@/server/firms/firms";
import { apiUser, errorResponse } from "@/server/http";

export const dynamic = "force-dynamic";

/** FR-F-002: firm typeahead for Section F (signed-in applicants; public register data only). */
export async function GET(request: NextRequest) {
  try {
    const { user } = await apiUser();
    await enforceRateLimit("lookup", user.id);
    return NextResponse.json(await searchFirms(request.nextUrl.searchParams.get("q") ?? ""));
  } catch (error) {
    return errorResponse(error);
  }
}
