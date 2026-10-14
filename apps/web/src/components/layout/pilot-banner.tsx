import { FlaskConical, MailWarning } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { isDevMode } from "@/server/env";

export async function PilotBanner() {
  const t = await getTranslations();
  return (
    <div className="bg-accent text-accent-foreground">
      <p className="container-page flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-1.5 text-center text-xs font-medium">
        <span className="inline-flex items-center gap-2">
          <FlaskConical className="size-3.5 shrink-0" aria-hidden />
          {t("common.pilotBanner")}
        </span>
        {isDevMode() && (
          <span
            className="inline-flex items-center gap-1.5 font-semibold"
            data-testid="dev-mode-banner"
          >
            <MailWarning className="size-3.5 shrink-0" aria-hidden />
            {t("devMode.banner")}
          </span>
        )}
      </p>
    </div>
  );
}
