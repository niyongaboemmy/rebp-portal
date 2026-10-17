import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CATEGORIES, type Category } from "@rebp/contracts";
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
export default async function EligibilityPage({ searchParams }: PageProps<"/eligibility">) {
  // "Check for this category" from the map: ?for=BROKER (unknown values are ignored).
  const value = (await searchParams).for;
  const target = (CATEGORIES as readonly string[]).includes(String(value))
    ? (value as Category)
    : undefined;
  return (
    <div className="flex flex-col">
      <EligibilityQuiz key={target ?? "any"} target={target} />
    </div>
  );
}
