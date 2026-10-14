import { Sparkles, type LucideIcon } from "@/components/icons";
import { getTranslations } from "next-intl/server";
import { OrbitArt } from "@/components/motion/orbit-art";
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
  const Icon = icon;
  return (
    <EmptyState
      icon={icon}
      art={
        art ?? (
          <OrbitArt
            className="max-w-[15rem] sm:max-w-[17rem]"
            center={<Icon className="size-12 text-link" aria-hidden />}
          />
        )
      }
      headingLevel={1}
      title={title}
      description={description}
      action={
        <div className="flex flex-col items-center gap-3 [&_a]:rounded-full">
          {action}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ember-soft px-3 py-1 text-xs font-semibold text-ember-text">
            <Sparkles className="size-3.5" aria-hidden /> {t("comingSoon")}
          </span>
        </div>
      }
    />
  );
}
