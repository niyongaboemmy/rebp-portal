import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SketchUnderline } from "@/components/motion/sketch-underline";
import { CategoriesHero } from "@/components/categories/categories-hero";
import { CategoryFaq } from "@/components/categories/category-faq";
import { CategoryMap } from "@/components/categories/category-map";
import { JsonLd } from "@/components/seo/json-ld";
import { publicPageMetadata } from "@/server/seo";

const FAQ = ["which", "upgrade", "firm"] as const;
const ACTIONS = {
  which: "/eligibility",
  upgrade: "#career-map",
  firm: "/register?kind=FIRM",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("categories");
  return publicPageMetadata({ path: "/categories", title: t("title"), description: t("subtitle") });
}

/** FR-PORTAL-007: category comparison as an interactive ladder, plus a short FAQ. */
export default async function CategoriesPage() {
  const t = await getTranslations("categories");
  return (
    <div className="flex flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((key) => ({
            "@type": "Question",
            name: t(`faq.${key}.q`),
            acceptedAnswer: { "@type": "Answer", text: t(`faq.${key}.a`) },
          })),
        }}
      />
      <CategoriesHero />
      <div className="container-page flex flex-col gap-16 pb-20 sm:gap-24 sm:pb-28">
        <div id="career-map" className="scroll-mt-24">
          <CategoryMap />
        </div>
        <CategoryFaq
          eyebrow={t("faqEyebrow")}
          title={
            <div className="flex flex-col gap-2">
              <h2 id="faq-title">{t("faqTitle")}</h2>
              <SketchUnderline className="h-2.5 w-28 sm:h-3 sm:w-32" />
            </div>
          }
          body={t("faqBody")}
          help={{ title: t("faqHelp.title"), body: t("faqHelp.body"), cta: t("faqHelp.cta") }}
          items={FAQ.map((key) => ({
            key,
            q: t(`faq.${key}.q`),
            a: t(`faq.${key}.a`),
            action: { label: t(`faq.${key}.action`), href: ACTIONS[key] },
          }))}
        />
      </div>
    </div>
  );
}
