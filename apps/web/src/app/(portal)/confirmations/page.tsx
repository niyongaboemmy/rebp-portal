import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/layout/coming-soon";
import { requireCapability } from "@/server/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("placeholders"))("confirmationsTitle") };
}

export default async function ConfirmationsPage() {
  await requireCapability("confirmation.decide");
  const t = await getTranslations("placeholders");
  return (
    <ComingSoon icon={Inbox} title={t("confirmationsTitle")} description={t("confirmationsBody")} />
  );
}
