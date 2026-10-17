import { NextResponse, type NextRequest } from "next/server";
import { recordAudit } from "@/server/audit/audit";
import { auditExport, EXPORT_FORMATS, type ExportFormat } from "@/server/audit/export";
import { parseAuditFilters } from "@/server/audit/filters";
import { contextOf, errorResponse, HttpError } from "@/server/http";
import { exportUser, maskedTerm } from "../_lib/authorize";

export const dynamic = "force-dynamic";

/**
 * Signed audit-trail export (FR-AUD-004): the same filters as the audit page, as CSV (default) or
 * JSON (`?format=json`), with a signed manifest. Gated by audit.export; the export itself is
 * audited ("audit.exported") with the count, hash and a masked echo of the filters.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await exportUser(["audit.export"]);
    const params = request.nextUrl.searchParams;
    const requested = params.get("format") ?? "csv";
    if (!(EXPORT_FORMATS as readonly string[]).includes(requested))
      throw new HttpError(400, "exportFormatInvalid");
    const format = requested as ExportFormat;
    const filters = parseAuditFilters(params);
    const { body, manifest } = await auditExport(filters, format, user.id);

    await recordAudit({
      action: "audit.exported",
      entityType: "AuditExport",
      entityId: manifest.sha256.slice(0, 16),
      actorId: user.id,
      metadata: {
        format,
        count: manifest.count,
        truncated: manifest.truncated,
        sha256: manifest.sha256,
        firstId: manifest.range.firstId,
        lastId: manifest.range.lastId,
        chainHead: manifest.chainHead?.hash ?? null,
        filters: { ...filters, actor: maskedTerm(filters.actor) },
      },
      ...contextOf(request),
    });

    const stamp = manifest.generatedAt.slice(0, 10);
    return new NextResponse(body, {
      headers: {
        "Content-Type":
          format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="rebp-audit-${stamp}.${format}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Audit-Export-Sha256": manifest.sha256,
        "X-Audit-Export-Signature": manifest.signature.value,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
