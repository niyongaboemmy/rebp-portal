import {
  BookUser,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  ListFilter,
  MapPin,
  X,
} from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";
import { OrbitArt } from "@/components/motion/orbit-art";
import { CATEGORY_INFO, REGISTER_PUBLIC_STATUSES, registerQuerySchema } from "@rebp/contracts";
import { RegistryFeed } from "@/components/registry/registry-feed";
import { ListSearch } from "@/components/ui/list-search";
import { SketchUnderline } from "@/components/motion/sketch-underline";
import { RegisterFilterBar } from "@/components/register/register-filter-bar";
import { RegisterMapView } from "@/components/register/register-map-view";
import { VerifySearch } from "@/components/register/verify-search";
import { chipClassName } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { enforceRateLimit } from "@/server/action";
import { isAppError } from "@/server/errors";
import { listDistricts } from "@/server/licensing/public-queries";
import { toPublicEntries } from "@/server/licensing/public-entry";
import { registerByDistrict } from "@/server/licensing/register-map";
import { REGISTER_PAGE_SIZE, searchRegister } from "@/server/licensing/register";
import { publicPageMetadata } from "@/server/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("register");
  return publicPageMetadata({
    path: "/register",
    title: t("title"),
    description: t("metaDescription"),
  });
}

function href(params: Record<string, string | number | undefined>): Route {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter((e): e is [string, string | number] => Boolean(e[1]))
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return (query ? `/register?${query}` : "/register") as Route;
}

const isPublicStatus = (s: string | undefined): s is (typeof REGISTER_PUBLIC_STATUSES)[number] =>
  (REGISTER_PUBLIC_STATUSES as readonly string[]).includes(s ?? "");

/**
 * FR-REG-001/002/003/005: public register search. Filters live in the URL (shareable, crawlable,
 * Back works). Only public fields are shown (FR-REG-003). Text searches spend the anonymous
 * anti-scraping budget (FR-REG-005); over budget, the page says so plainly.
 */
export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const t = await getTranslations();
  const raw = await searchParams;
  const parsed = registerQuerySchema.parse(raw);
  // The register opens on the map; the list is one tap away (and where pagination lives).
  const view = raw.view === "list" ? "list" : "map";
  const q = parsed.q ?? "";
  const { category, district, kind } = parsed;
  const status = isPublicStatus(parsed.status) ? parsed.status : undefined;
  const base = { q, category, status, district, kind, view: view === "list" ? "list" : undefined };

  let retryAfterSeconds: number | null = null;
  if (q) {
    try {
      await enforceRateLimit("registerSearch");
    } catch (error) {
      if (!isAppError(error) || error.code !== "rateLimited") throw error;
      retryAfterSeconds = Number(error.meta?.retryAfterSeconds ?? 60);
    }
  }

  // The map stays mounted under the list overlay, so both read models load in every view.
  const [districts, result, mapGroups] = await Promise.all([
    listDistricts(),
    retryAfterSeconds === null ? searchRegister({ ...parsed, q: q || undefined, status }) : null,
    retryAfterSeconds === null
      ? registerByDistrict({ ...parsed, q: q || undefined, status })
      : Promise.resolve([]),
  ]);
  const districtNames = new Map(districts.map((d) => [d.code, d.name]));
  const publicEntries = result ? await toPublicEntries(result.entries) : [];
  // "Show on map" from elsewhere (verify): /register?q=<no>&spot=<no> filters to that licence and
  // pins it on the map.
  const spotNo = typeof raw.spot === "string" ? raw.spot : undefined;
  const spot = spotNo ? publicEntries.find((e) => e.licenceNo === spotNo) : undefined;
  const total = result?.total ?? 0;
  const page = result?.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / REGISTER_PAGE_SIZE));
  // Filters as a query string for the list's infinite scroll (no page, no view).
  const feedQuery = href({ q, category, status, district, kind }).split("?")[1] ?? "";
  const filtered = Boolean(q || category || status || district || kind);
  const districtName = district ? districts.find((d) => d.code === district)?.name : undefined;
  const active = [
    q && { key: "q", label: `"${q}"`, clear: href({ ...base, q: undefined }) },
    category && {
      key: "category",
      label: CATEGORY_INFO[category].abbreviation,
      clear: href({ ...base, category: undefined }),
    },
    status && {
      key: "status",
      label: t(`status.licence.${status}`),
      clear: href({ ...base, status: undefined }),
    },
    kind && {
      key: "kind",
      label: t(`registerResults.kind.${kind}`),
      clear: href({ ...base, kind: undefined }),
    },
    district && {
      key: "district",
      label: districtName ?? district,
      clear: href({ ...base, district: undefined }),
    },
  ].filter(Boolean) as { key: string; label: string; clear: Route }[];

  const viewToggle = (
    <nav
      aria-label={t("registerResults.view.label")}
      className="flex shrink-0 rounded-full bg-foreground/[0.05] p-0.5 dark:bg-white/[0.06]"
    >
      {(["map", "list"] as const).map((v) => (
        <Link
          key={v}
          href={href({
            ...base,
            view: v === "list" ? "list" : undefined,
            page: undefined,
          })}
          aria-current={view === v ? "page" : undefined}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm dark:aria-[current=page]:bg-white/[0.1]"
        >
          {v === "map" ? (
            <MapPin className="size-4" aria-hidden />
          ) : (
            <ListFilter className="size-4" aria-hidden />
          )}
          {t(`registerResults.view.${v}`)}
        </Link>
      ))}
    </nav>
  );
  const listContent = (
    <div className="flex flex-col gap-3">
      {/* List header: count and a live search over the whole register (keeps the filters). */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-sm font-semibold" aria-live="polite">
          {t("registerResults.count", { count: total })}
        </p>
        <ListSearch
          label={t("registerResults.searchList")}
          placeholder={t("registerResults.searchList")}
          clearLabel={t("verify.clear")}
          className="w-full @md:w-64"
        />
      </div>
      {retryAfterSeconds !== null ? (
        <EmptyState
          icon={Hourglass}
          title={t("registerResults.rateLimitedTitle")}
          description={t("registerResults.rateLimitedBody", {
            minutes: Math.max(1, Math.ceil(retryAfterSeconds / 60)),
          })}
        />
      ) : !result || result.entries.length === 0 ? (
        <EmptyState
          icon={BookUser}
          art={
            <OrbitArt
              className="max-w-[16rem]"
              center={<BookUser className="size-12 text-link" />}
            />
          }
          title={
            q
              ? t("register.noResults", { query: q })
              : filtered
                ? t("registerResults.noMatch")
                : t("register.emptyTitle")
          }
          description={
            filtered ? t("registerResults.noResultsBody") : t("placeholders.registerBody")
          }
          action={
            filtered ? (
              <Link href="/register" className={chipClassName(false)}>
                {t("registerResults.clearFilters")}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {active.map(({ key, label, clear }) => (
                <Link
                  key={key}
                  href={clear}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-primary-soft py-1 pr-1.5 pl-3 text-xs font-semibold text-primary-soft-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  aria-label={t("registerResults.removeFilter", { filter: label })}
                >
                  {label}
                  <X className="size-3.5" aria-hidden />
                </Link>
              ))}
              {active.length > 1 && (
                <Link href="/register" className="text-xs font-semibold text-link hover:underline">
                  {t("registerResults.clearFilters")}
                </Link>
              )}
            </div>
          )}
          <RegistryFeed
            key={feedQuery}
            initial={publicEntries}
            page={page}
            pages={pages}
            total={total}
            query={feedQuery}
            firstPageHref={href({ ...base, page: undefined })}
          />
          {/* Without JavaScript (and for crawlers): plain page links. */}
          {pages > 1 && (
            <noscript>
              <nav
                aria-label={t("registerResults.pagination")}
                className="flex flex-wrap items-center justify-center gap-2 pt-2"
              >
                {page > 1 && (
                  <Link
                    href={href({ ...base, page: page - 1 > 1 ? page - 1 : undefined })}
                    rel="prev"
                    className={chipClassName(false)}
                  >
                    <ChevronLeft aria-hidden /> {t("registerResults.previous")}
                  </Link>
                )}
                <span className="rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold num dark:bg-white/[0.05]">
                  {t("registerResults.page", { page, pages })}
                </span>
                {page < pages && (
                  <Link
                    href={href({ ...base, page: page + 1 })}
                    rel="next"
                    className={chipClassName(false)}
                  >
                    {t("registerResults.next")} <ChevronRight aria-hidden />
                  </Link>
                )}
              </nav>
            </noscript>
          )}
        </>
      )}
    </div>
  );

  // The map fills the screen under the header and never goes away; the filters float over it,
  // and the list view adds the paginated results as another floating panel.
  return (
    <RegisterMapView
      districts={districts}
      list={view === "list" ? listContent : undefined}
      spot={spot}
      selectedCode={district}
      groups={mapGroups.map((g) => ({
        code: g.code,
        name: districtNames.get(g.code) ?? g.code,
        total: g.total,
        valid: g.valid,
        firms: g.firms,
        preview: g.preview.map((p) => ({
          licenceNo: p.licenceNo,
          displayName: p.displayName,
          category: p.category,
          status: p.status,
        })),
        listHref: href({ ...base, view: "list", district: g.code }),
      }))}
    >
      {/* One vertical rhythm: 16px between title, search and filters. */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[clamp(1.6rem,1.2rem+1.2vw,2.1rem)] leading-none font-bold tracking-[-0.02em]">
              {t("nav.short.register")}
            </h1>
            <SketchUnderline className="h-2 w-20 sm:h-2.5 sm:w-24" />
          </div>
          {viewToggle}
        </div>
        <VerifySearch
          key={q}
          defaultValue={q}
          hiddenFields={{ view: base.view }}
          tone="solid"
          examples={(["number", "name", "firm"] as const).map((k) => t(`check.examples.${k}`))}
          examplesLabel={t("check.tryTyping")}
          inline
        />
        <RegisterFilterBar
          districts={districts}
          counts={Object.fromEntries(mapGroups.map((g) => [g.code, g.total]))}
          total={total}
        />
      </div>
    </RegisterMapView>
  );
}
