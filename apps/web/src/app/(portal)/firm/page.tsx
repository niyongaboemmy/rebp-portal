import { Building2 } from "@/components/icons";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";
import { requireCapability } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("placeholders"))("firmTitle") };
}

export default async function FirmPage() {
  await requireCapability("firmRoles.manage");
  const t = await getTranslations("placeholders");
  return <ComingSoon icon={Building2} title={t("firmTitle")} description={t("firmBody")} />;
}
