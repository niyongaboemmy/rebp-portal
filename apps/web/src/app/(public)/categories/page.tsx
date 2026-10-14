import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CATEGORIES, CATEGORY_INFO } from "@rebp/contracts";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("categories"))("title") };
}

/** FR-PORTAL-007 (initial): category comparison. */
export default async function CategoriesPage() {
  const t = await getTranslations("categories");
  return (
    <div className="container-page flex flex-col gap-8 py-10 sm:py-14">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ul className="grid gap-4 md:grid-cols-2">
        {CATEGORIES.map((code) => (
          <li key={code} className="flex gap-4 rounded-2xl border bg-card p-5">
            <span className="inline-flex h-12 min-w-12 items-center justify-center rounded-xl bg-secondary font-mono text-sm font-bold text-secondary-foreground">
              {CATEGORY_INFO[code].section}
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg">{t(`items.${code}.name`)}</h2>
                <Badge variant="outline">{t(`tiers.${CATEGORY_INFO[code].tier}`)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t(`items.${code}.summary`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
