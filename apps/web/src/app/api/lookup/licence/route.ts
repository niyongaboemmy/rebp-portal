import { NextResponse, type NextRequest } from "next/server";
import { CATEGORIES, type Category } from "@rebp/contracts";
import { enforceRateLimit } from "@/server/action";
import { lookupLicence, searchLicences } from "@/server/firms/firms";
import { apiUser, errorResponse } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * FR-F-004: supervisor / licence lookup by number (public register fields only). With `q`, a
 * search by name, firm or part of the number among active licences of the given categories
 * (UX-023), so an applicant can find their supervisor without knowing the number by heart.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await apiUser();
    await enforceRateLimit("lookup", user.id);
    const params = request.nextUrl.searchParams;
    const q = params.get("q");
    if (q !== null) {
      const categories = (params.get("categories") ?? "")
        .split(",")
        .filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));
      return NextResponse.json(await searchLicences(q, categories));
    }
    const no = params.get("no") ?? "";
    return NextResponse.json(no.trim().length >= 4 ? await lookupLicence(no) : null);
  } catch (error) {
    return errorResponse(error);
  }
}
