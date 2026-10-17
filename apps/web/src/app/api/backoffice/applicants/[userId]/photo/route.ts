import type { NextRequest } from "next/server";
import { userCan } from "@/server/access/permissions";
import { apiUser, errorResponse, fileResponse, HttpError } from "@/server/http";
import { readApplicantPhoto } from "@/server/profile/documents";

export const dynamic = "force-dynamic";

/** Staff who handle applications or people (UX-035); anyone else gets 403. */
const MAY_SEE = ["application.view", "review.view", "decision.view", "access.view"] as const;

/**
 * An applicant's current profile photo for the back office (UX-035): the avatars in queues and
 * lists, and the full-size view on the review and decision consoles. Never for the public.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/backoffice/applicants/[userId]/photo">,
) {
  try {
    const { userId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new HttpError(404, "notFound");
    const { user } = await apiUser("backoffice.access");
    const allowed = await Promise.all(MAY_SEE.map((c) => userCan(user, c)));
    if (!allowed.some(Boolean)) throw new HttpError(403, "forbidden");
    const file = await readApplicantPhoto(userId);
    return fileResponse(file.bytes, {
      contentType: file.mimeType,
      fileName: file.fileName,
      inline: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
