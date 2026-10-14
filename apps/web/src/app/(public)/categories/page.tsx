import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CategoryLadder } from "@/components/categories/category-ladder";
import { JsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="container-page flex flex-col gap-10 py-10 sm:py-14">
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
      <PageHeader title={t("title")} description={t("subtitle")} />
      <CategoryLadder />
      <section aria-labelledby="faq-title" className="flex max-w-3xl flex-col gap-3">
        <h2 id="faq-title">{t("faqTitle")}</h2>
        {FAQ.map((key) => (
          <details
            key={key}
            className="group rounded-2xl border bg-card p-4 raised [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {t(`faq.${key}.q`)}
              <span
                aria-hidden
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-lg transition-transform duration-(--dur-3) ease-spring group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="pt-3 text-sm text-muted-foreground">{t(`faq.${key}.a`)}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
