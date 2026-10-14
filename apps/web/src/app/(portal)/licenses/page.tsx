import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";
import { requireUser } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("placeholders"))("licensesTitle") };
}

export default async function LicensesPage() {
  await requireUser();
  const t = await getTranslations("placeholders");
  return (
    <ComingSoon
      icon={Wallet}
      title={t("licensesTitle")}
      description={t("licensesBody")}
      milestone="D4 — WP-3.9"
    />
  );
}
