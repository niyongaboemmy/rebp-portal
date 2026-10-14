import { Sparkles, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";

/** Placeholder for areas that open later: one picture, one line, one action — no dev jargon. */
export async function ComingSoon({
  icon,
  title,
  description,
  action,
  art,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  art?: React.ReactNode;
}) {
  const t = await getTranslations("common");
  return (
    <EmptyState
      icon={icon}
      art={art}
      title={title}
      description={description}
      action={
        <div className="flex flex-col items-center gap-3">
          {action}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Sparkles className="size-3.5" aria-hidden /> {t("comingSoon")}
          </span>
        </div>
      }
    />
  );
}
