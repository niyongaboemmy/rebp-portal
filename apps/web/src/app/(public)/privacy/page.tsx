import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("privacy"))("title") };
}

/** PRV-002 privacy notice (placeholder text pending legal approval, P4). */
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <article className="container-page flex max-w-3xl flex-col gap-6 py-10 sm:py-14">
      <h1>{t("title")}</h1>
      <Alert variant="warning">{t("draft")}</Alert>
      <p className="text-lg leading-relaxed">{t("body")}</p>
    </article>
  );
}
