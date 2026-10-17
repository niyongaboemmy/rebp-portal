import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "@/server/action";
import { apiUser, assertSameOrigin, contextOf, errorResponse, HttpError } from "@/server/http";
import { uploadProfileDocument } from "@/server/profile/documents";

export const dynamic = "force-dynamic";

/**
 * Profile identity document upload (UX-010). Multipart: type, optional replaceId, file. Same
 * limits and checks as application uploads; a route handler so the browser reports progress.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (Number(request.headers.get("content-length") ?? 0) > 6 * 1024 * 1024)
      throw new HttpError(413, "payloadTooLarge");
    // Self-service: every person keeps a profile photo and ID (checked in uploadProfileDocument).
    const { user } = await apiUser();
    await enforceRateLimit("upload", user.id);
    const form = await request.formData();
    const file = form.get("file");
    const type = String(form.get("type") ?? "");
    const replaceId = form.get("replaceId") ? String(form.get("replaceId")) : undefined;
    if (!(file instanceof File)) throw new HttpError(400, "validation");
    const result = await uploadProfileDocument(
      user,
      { type, replaceId, fileName: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
      contextOf(request),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
