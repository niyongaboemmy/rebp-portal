import { FileStack } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";
import { requireCapability } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("placeholders"))("applicationsTitle") };
}

export default async function ApplicationsPage() {
  await requireCapability("application.edit");
  const t = await getTranslations("placeholders");
  return (
    <ComingSoon
      icon={FileStack}
      title={t("applicationsTitle")}
      description={t("applicationsBody")}
      milestone="D2 — WP-1.1/1.2"
    />
  );
}
