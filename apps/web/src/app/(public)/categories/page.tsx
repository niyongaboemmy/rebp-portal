import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SketchUnderline } from "@/components/motion/sketch-underline";
import { Reveal } from "@/components/motion/reveal";
import { PageHero } from "@/components/layout/page-hero";
import { CategoryMap } from "@/components/categories/category-map";
import { JsonLd } from "@/components/seo/json-ld";
import { publicPageMetadata } from "@/server/seo";

const FAQ = ["which", "upgrade", "firm"] as const;

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
      <PageHero eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} />
      <div className="container-page flex flex-col gap-16 pb-20 sm:gap-20 sm:pb-28">
        <CategoryMap />
        <section aria-labelledby="faq-title" className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
          <div className="flex flex-col gap-2">
            <h2 id="faq-title">{t("faqTitle")}</h2>
            <SketchUnderline className="h-2.5 w-28 sm:h-3 sm:w-32" />
          </div>
          <div className="flex flex-col gap-3">
            {FAQ.map((key, index) => (
              <Reveal key={key} stagger={index}>
                <details className="group rounded-2xl bg-surface-2 p-1 transition-colors open:bg-primary-soft/40 dark:bg-white/[0.03] dark:open:bg-primary/[0.08] [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-4 font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
                    {t(`faq.${key}.q`)}
                    <span
                      aria-hidden
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-lg text-link transition-[transform,background-color,color] duration-(--dur-3) ease-spring group-open:rotate-45 group-open:bg-primary group-open:text-primary-foreground dark:bg-white/[0.06]"
                    >
                      +
                    </span>
                  </summary>
                  <p className="animate-rise px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                    {t(`faq.${key}.a`)}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
