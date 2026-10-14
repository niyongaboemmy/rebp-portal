import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("placeholders"))("eligibilityTitle") };
}

export default async function EligibilityPage() {
  const t = await getTranslations("placeholders");
  return (
    <div className="container-page py-10 sm:py-14">
      <EmptyState
        icon={ListChecks}
        title={t("eligibilityTitle")}
        description={t("eligibilityBody")}
      />
    </div>
  );
}
