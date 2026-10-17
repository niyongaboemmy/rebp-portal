import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "@/server/action";
import { uploadDocument } from "@/server/documents/documents";
import { apiUser, assertSameOrigin, contextOf, errorResponse, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Document upload (FR-DOC-001…007). Multipart: applicationId, type, optional replaceId, file.
 * A route handler (not a server action) so the browser can report upload progress (FR-DOC-006).
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    // The largest document is 5 MB; refuse bigger bodies before reading them into memory.
    if (Number(request.headers.get("content-length") ?? 0) > 6 * 1024 * 1024)
      throw new HttpError(413, "payloadTooLarge");
    const { user } = await apiUser("application.edit");
    await enforceRateLimit("upload", user.id);
    const form = await request.formData();
    const file = form.get("file");
    const applicationId = String(form.get("applicationId") ?? "");
    const type = String(form.get("type") ?? "");
    const replaceId = form.get("replaceId") ? String(form.get("replaceId")) : undefined;
    if (!(file instanceof File) || !/^[0-9a-f-]{36}$/i.test(applicationId))
      throw new HttpError(400, "validation");
    const result = await uploadDocument(
      {
        applicationId,
        type,
        replaceId,
        fileName: file.name,
        bytes: Buffer.from(await file.arrayBuffer()),
      },
      user,
      contextOf(request),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
