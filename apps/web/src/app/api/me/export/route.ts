import { NextResponse, type NextRequest } from "next/server";
import { apiUser, contextOf, errorResponse } from "@/server/http";
import { exportPersonalData } from "@/server/privacy/dsar";

export const dynamic = "force-dynamic";

/** FR-DSR-001: download a machine-readable copy of my personal data. */
export async function GET(request: NextRequest) {
  try {
    const { user } = await apiUser();
    const data = await exportPersonalData(user.id, contextOf(request));
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="rebp-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
