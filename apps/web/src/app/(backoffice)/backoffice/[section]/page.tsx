import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";
import { BACKOFFICE_SECTIONS, type BackofficeSection } from "@/config/navigation";
import { requireCapability } from "@/server/auth/guards";

function isSection(value: string): value is BackofficeSection {
  return Object.hasOwn(BACKOFFICE_SECTIONS, value);
}

export default async function BackofficeSectionPage({
  params,
}: PageProps<"/backoffice/[section]">) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  const config = BACKOFFICE_SECTIONS[section];
  await requireCapability(config.capability);
  const t = await getTranslations();
  return (
    <ComingSoon
      icon={config.icon}
      title={t(`nav.${config.label}`)}
      description={t("placeholders.backofficeBody")}
      milestone={config.milestone}
    />
  );
}
