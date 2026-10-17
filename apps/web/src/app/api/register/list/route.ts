import { NextResponse, type NextRequest } from "next/server";
import { REGISTER_PUBLIC_STATUSES, registerQuerySchema } from "@rebp/contracts";
import { enforceRateLimit } from "@/server/action";
import { errorResponse } from "@/server/http";
import { toPublicEntries } from "@/server/licensing/public-entry";
import { REGISTER_PAGE_SIZE, searchRegister } from "@/server/licensing/register";

export const dynamic = "force-dynamic";

/**
 * FR-REG-002: one page of the public register for the list's infinite scroll (public fields
 * only, FR-REG-003). Same query and budget as the page itself: text searches spend the
 * anonymous anti-scraping budget (FR-REG-005), so scrolling can't bypass it.
 */
export async function GET(request: NextRequest) {
  try {
    const parsed = registerQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const status = (REGISTER_PUBLIC_STATUSES as readonly string[]).includes(parsed.status ?? "")
      ? parsed.status
      : undefined;
    if (parsed.q) await enforceRateLimit("registerSearch");
    const result = await searchRegister({ ...parsed, status, page: parsed.page ?? 1 });
    return NextResponse.json(
      {
        entries: await toPublicEntries(result.entries),
        page: result.page,
        pages: Math.max(1, Math.ceil(result.total / REGISTER_PAGE_SIZE)),
        total: result.total,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
