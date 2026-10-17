import type { NextRequest } from "next/server";
import { apiUser, errorResponse, fileResponse, HttpError } from "@/server/http";
import {
  acknowledgmentFor,
  certificateFor,
  decisionLetterFor,
  receiptFor,
} from "@/server/licensing/official-documents";

export const dynamic = "force-dynamic";

const BUILDERS = {
  certificate: certificateFor,
  receipt: receiptFor,
  acknowledgment: acknowledgmentFor,
  letter: decisionLetterFor,
} as const;

/** FR-PORTAL-003: certificate, receipt, acknowledgment and decision letter as PDF. */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/files/[kind]/[id]">,
) {
  try {
    const { kind, id } = await params;
    if (!Object.hasOwn(BUILDERS, kind) || !/^[0-9a-f-]{36}$/i.test(id))
      throw new HttpError(404, "notFound");
    const { user } = await apiUser();
    const { bytes, fileName } = await BUILDERS[kind as keyof typeof BUILDERS](id, user);
    return fileResponse(bytes, {
      contentType: "application/pdf",
      fileName,
      inline: request.nextUrl.searchParams.get("download") !== "1",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
