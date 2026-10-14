import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { NO_INDEX } from "@/server/seo";

export const dynamic = "force-static";
export const metadata: Metadata = { robots: NO_INDEX };

/** Served by the service worker when a page can't load (UX-015). Static: no session, no data. */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main id="main" className="container-page flex min-h-dvh items-center justify-center py-14">
      <EmptyState
        icon={WifiOff}
        title={t("title")}
        description={t("body")}
        className="w-full max-w-lg"
      />
    </main>
  );
}
