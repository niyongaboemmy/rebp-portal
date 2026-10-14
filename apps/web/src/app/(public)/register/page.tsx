import { BookUser } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";
import { CATEGORIES, CATEGORY_INFO, LICENSE_STATUSES } from "@rebp/contracts";
import { VerifySearch } from "@/components/register/verify-search";
import { chipClassName, ChipRow } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { publicPageMetadata } from "@/server/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("register");
  return publicPageMetadata({
    path: "/register",
    title: t("title"),
    description: t("metaDescription"),
  });
}

function href(params: Record<string, string | undefined>): Route {
  const query = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();
  return (query ? `/register?${query}` : "/register") as Route;
}

const PUBLIC_STATUSES = LICENSE_STATUSES.filter((s) =>
  ["ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"].includes(s),
);

/**
 * FR-REG-001/002: public register search. Filters live in the URL (shareable, crawlable,
 * Back works). Entries appear once the first licences are issued (Section N).
 */
export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const t = await getTranslations();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const category = typeof params.category === "string" ? params.category : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;

  return (
    <div className="relative isolate">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-72 bg-ambient" />
      <div className="container-page flex flex-col gap-6 py-8 sm:py-12">
        <div className="flex flex-col gap-1.5">
          <h1>{t("register.title")}</h1>
          <p className="text-muted-foreground">{t("register.subtitle")}</p>
        </div>
        <VerifySearch defaultValue={q} className="max-w-2xl" />

        <nav aria-label={t("register.filterCategory")} className="flex flex-col gap-2">
          <ChipRow>
            <Link
              href={href({ q, status })}
              aria-current={!category ? "true" : undefined}
              className={chipClassName(!category)}
            >
              {t("register.all")}
            </Link>
            {CATEGORIES.map((c) => (
              <Link
                key={c}
                href={href({ q, status, category: c })}
                aria-current={category === c ? "true" : undefined}
                className={chipClassName(category === c)}
              >
                {CATEGORY_INFO[c].abbreviation}
              </Link>
            ))}
          </ChipRow>
        </nav>
        <nav aria-label={t("register.filterStatus")}>
          <ChipRow>
            {PUBLIC_STATUSES.map((s) => (
              <Link
                key={s}
                href={href({ q, category, status: status === s ? undefined : s })}
                aria-current={status === s ? "true" : undefined}
                className={chipClassName(status === s)}
              >
                {t(`status.licence.${s}`)}
              </Link>
            ))}
          </ChipRow>
        </nav>

        <EmptyState
          icon={BookUser}
          title={q ? t("register.noResults", { query: q }) : t("register.emptyTitle")}
          description={t("placeholders.registerBody")}
        />
      </div>
    </div>
  );
}
