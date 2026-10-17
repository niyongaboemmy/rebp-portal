import type { NextRequest } from "next/server";
import { apiUser, errorResponse, fileResponse } from "@/server/http";
import { readProfileDocument } from "@/server/profile/documents";

export const dynamic = "force-dynamic";

/** The owner's own profile document (UX-010); `?download=1` returns an attachment. */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/profile/documents/[id]">,
) {
  try {
    const { id } = await params;
    const { user } = await apiUser();
    const download = request.nextUrl.searchParams.get("download") === "1";
    const file = await readProfileDocument(id, user);
    return fileResponse(file.bytes, {
      contentType: file.mimeType,
      fileName: file.fileName,
      inline: !download,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
