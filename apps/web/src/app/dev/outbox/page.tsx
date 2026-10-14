import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/utils";
import { db } from "@/server/db";
import { isDevMode } from "@/server/env";

export const dynamic = "force-dynamic";

/** APP_ENV=dev mailbox for the email/SMS mock adapters (stands in for Mailpit). */
export default async function OutboxPage() {
  if (!isDevMode()) notFound();
  const t = await getTranslations("outbox");
  const messages = await db.notificationLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <main id="main" className="container-page flex flex-col gap-6 py-10">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {messages.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
      <ul className="flex flex-col gap-3">
        {messages.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={m.channel === "SMS" ? "info" : "default"}>{m.channel}</Badge>
              <span className="font-semibold">{m.recipient}</span>
              <span className="font-mono text-xs text-muted-foreground">{m.template}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDateTime(m.createdAt)}
              </span>
            </div>
            {m.subject && <p className="font-medium">{m.subject}</p>}
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
              {m.body}
            </pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
