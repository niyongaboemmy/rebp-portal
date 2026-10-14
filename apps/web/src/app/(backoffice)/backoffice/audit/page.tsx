import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/utils";
import { verifyAuditChain } from "@/server/audit/audit";
import { requireCapability } from "@/server/auth/guards";
import { db } from "@/server/db";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("audit"))("title") };
}

/** FR-AUD-001…003: recent events plus a live verification of the hash chain. */
export default async function AuditPage() {
  await requireCapability("audit.view");
  const t = await getTranslations("audit");
  const [events, chain] = await Promise.all([
    db.auditEvent.findMany({ orderBy: { id: "desc" }, take: 50 }),
    verifyAuditChain(),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {chain.ok ? (
        <Alert variant="success" title={t("chainOk", { count: chain.checked })} />
      ) : (
        <Alert variant="danger" title={t("chainBroken", { id: String(chain.brokenAtId) })} />
      )}
      {events.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">
                  {t("columns.time")}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t("columns.action")}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t("columns.entity")}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t("columns.ip")}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t("columns.hash")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((e) => (
                <tr key={String(e.id)}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(e.occurredAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {e.entityType}:{e.entityId?.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-xs">{e.ipAddress ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {e.hash.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
