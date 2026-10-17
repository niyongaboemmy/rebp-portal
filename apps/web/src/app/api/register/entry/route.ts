import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "@/server/action";
import { errorResponse } from "@/server/http";
import { toPublicEntries } from "@/server/licensing/public-entry";
import { findRegisterEntry } from "@/server/licensing/register";

export const dynamic = "force-dynamic";

/** FR-REG-004: one register entry by licence number, for the registry preview (public fields). */
export async function GET(request: NextRequest) {
  try {
    await enforceRateLimit("lookup");
    const no = (request.nextUrl.searchParams.get("no") ?? "").trim().slice(0, 40);
    const found = no ? await findRegisterEntry(no) : null;
    if (!found?.entry) return NextResponse.json(null, { status: 404 });
    const [entry] = await toPublicEntries([found.entry]);
    return NextResponse.json(entry);
  } catch (error) {
    return errorResponse(error);
  }
}
