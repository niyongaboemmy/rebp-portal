import type { NextRequest } from "next/server";
import { readDocument } from "@/server/documents/documents";
import { apiUser, contextOf, errorResponse, fileResponse } from "@/server/http";
import { watermarked } from "@/server/pdf/pdf";

export const dynamic = "force-dynamic";

/**
 * Authorised document read (FR-DOC-008). `?download=1` returns an attachment; staff downloads are
 * watermarked with the officer and time (FR-L-011). Previews render inline in the portal viewer.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/documents/[id]">) {
  try {
    const { id } = await params;
    const { user } = await apiUser();
    const download = request.nextUrl.searchParams.get("download") === "1";
    const version = Number(request.nextUrl.searchParams.get("v")) || undefined;
    const file = await readDocument(id, user, contextOf(request), { version, download });
    if (download && file.isStaff) {
      const mark = `${user.fullName} · ${user.id.slice(0, 8)} · ${new Date().toISOString().slice(0, 16)}Z`;
      const bytes = await watermarked(file.bytes, file.mimeType, mark);
      return fileResponse(bytes, {
        contentType: "application/pdf",
        fileName: `${file.fileName.replace(/\.\w+$/, "")}-watermarked.pdf`,
        inline: false,
      });
    }
    return fileResponse(file.bytes, {
      contentType: file.mimeType,
      fileName: file.fileName,
      inline: !download,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
