import { FlaskConical } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function PilotBanner() {
  const t = await getTranslations("common");
  return (
    <div className="bg-accent text-accent-foreground">
      <p className="container-page flex items-center justify-center gap-2 py-1.5 text-center text-xs font-medium">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        {t("pilotBanner")}
      </p>
    </div>
  );
}
