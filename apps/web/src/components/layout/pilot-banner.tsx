import { FlaskConical, MailWarning } from "@/components/icons";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { isDevMode } from "@/server/env";
import { PILOT_BANNER_COOKIE } from "./pilot-banner-cookie";
import { DismissBanner } from "./pilot-banner-dismiss";

/**
 * One-line pilot notice. Dismissible for the browser session (a session cookie, read on the
 * server so it never flashes back). The dev-mode notice is not dismissible.
 */
export async function PilotBanner() {
  const [t, jar] = await Promise.all([getTranslations(), cookies()]);
  const dismissed = jar.get(PILOT_BANNER_COOKIE)?.value === "1";
  const dev = isDevMode();
  if (dismissed && !dev) return null;
  return (
    <aside aria-label={t("common.notice")} className="bg-accent text-accent-foreground">
      <div className="container-page flex items-center gap-2 py-1">
        <p className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-0.5 py-0.5 text-center text-xs font-medium">
          {!dismissed && (
            <span className="inline-flex items-center gap-2">
              <FlaskConical className="size-3.5 shrink-0" aria-hidden />
              {t("common.pilotBanner")}
            </span>
          )}
          {dev && (
            <span
              className="inline-flex items-center gap-1.5 font-semibold"
              data-testid="dev-mode-banner"
            >
              <MailWarning className="size-3.5 shrink-0" aria-hidden />
              {t("devMode.banner")}
            </span>
          )}
        </p>
        {!dismissed && <DismissBanner label={t("common.dismiss")} />}
      </div>
    </aside>
  );
}
