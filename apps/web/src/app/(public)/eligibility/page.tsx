import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/page-hero";
import { EligibilityQuiz } from "@/components/eligibility/eligibility-quiz";
import { publicPageMetadata } from "@/server/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("eligibility");
  return publicPageMetadata({
    path: "/eligibility",
    title: t("title"),
    description: t("metaDescription"),
  });
}

/** FR-PORTAL-006: public, no-login eligibility pre-check. */
export default async function EligibilityPage() {
  const t = await getTranslations("eligibility");
  return (
    <div className="flex flex-col">
      <PageHero eyebrow={t("eyebrow")} title={t("title")} description={t("metaDescription")} />
      <div className="container-page flex flex-col pb-20 sm:pb-28 [&>*]:max-w-3xl">
        <EligibilityQuiz />
      </div>
    </div>
  );
}
