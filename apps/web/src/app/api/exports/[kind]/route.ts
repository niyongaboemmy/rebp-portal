import { NextResponse, type NextRequest } from "next/server";
import { recordAudit } from "@/server/audit/audit";
import { applicationsCsv, paymentsCsv, toCsv } from "@/server/backoffice/reports";
import { firmRoster } from "@/server/firms/firms";
import { apiUser, contextOf, errorResponse, HttpError } from "@/server/http";
import { dayOf } from "@/server/time";

export const dynamic = "force-dynamic";

/** CSV exports (FR-RPT-005, FR-FIRM-002), restricted by capability and audited. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/exports/[kind]">) {
  try {
    const { kind } = await params;
    let csv: string;
    let name: string;
    let actorId: string;
    if (kind === "applications") {
      const { user } = await apiUser("reports.view");
      if (
        !user.roles.some(
          (r) =>
            r !== "APPLICANT" &&
            r !== "SUPERVISOR" &&
            r !== "PRINCIPAL_BROKER" &&
            r !== "FIRM_ADMIN",
        )
      )
        throw new HttpError(403, "forbidden");
      csv = await applicationsCsv();
      name = "applications";
      actorId = user.id;
    } else if (kind === "payments") {
      const { user } = await apiUser("payments.view");
      csv = await paymentsCsv();
      name = "payments";
      actorId = user.id;
    } else if (kind === "roster") {
      const { user } = await apiUser("firmRoles.manage");
      const firmId = request.nextUrl.searchParams.get("firm") ?? "";
      const roster = await firmRoster(firmId, user);
      csv = toCsv(
        [
          "name",
          "registration",
          "licence",
          "category",
          "status",
          "expires",
          "supervisor",
          "branch",
        ],
        roster.map((r) => [
          r.displayName,
          r.registrant.registrationNo,
          r.licenceNo,
          r.category,
          r.status,
          dayOf(r.expiresAt),
          r.supervisor ? `${r.supervisor.displayName} (${r.supervisor.licenceNo})` : "",
          r.branch?.name ?? "",
        ]),
      );
      name = "roster";
      actorId = user.id;
    } else throw new HttpError(404, "notFound");
    await recordAudit({
      action: "report.exported",
      entityType: "Report",
      entityId: name,
      actorId,
      ...contextOf(request),
    });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rebp-${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
