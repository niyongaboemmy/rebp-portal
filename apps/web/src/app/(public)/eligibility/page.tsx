import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
    <div className="relative isolate">
      <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
      <div className="container-page flex max-w-2xl flex-col gap-6 py-8 sm:py-14">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-link">{t("eyebrow")}</span>
          <h1 className="sr-only">{t("title")}</h1>
        </div>
        <EligibilityQuiz />
      </div>
    </div>
  );
}
