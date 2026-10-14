import { FlaskConical } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";

/** Compact reminder on auth pages that codes are simulated (APP_ENV=dev). */
export async function DevModeChip() {
  const t = await getTranslations("devMode");
  return (
    <Badge variant="warning" className="mr-1 hidden xs:inline-flex" title={t("banner")}>
      <FlaskConical /> {t("chip")}
    </Badge>
  );
}
