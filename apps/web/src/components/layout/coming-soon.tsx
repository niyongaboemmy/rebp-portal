import type { LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/** Placeholder for areas scheduled later in the delivery plan. */
export async function ComingSoon({
  icon,
  title,
  description,
  milestone,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  milestone?: string;
  action?: React.ReactNode;
}) {
  const t = await getTranslations();
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={
        <div className="flex flex-col items-center gap-3">
          {action}
          <Badge variant="accent">
            {milestone ? t("placeholders.plannedFor", { milestone }) : t("common.comingSoon")}
          </Badge>
        </div>
      }
    />
  );
}
