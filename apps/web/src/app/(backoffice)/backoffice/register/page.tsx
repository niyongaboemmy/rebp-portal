import { ChevronLeft, ChevronRight, CircleCheck, SearchX } from "@/components/icons";
import { CategoryTile } from "@/components/applications/category-tile";
import { applicantPhotoUrls } from "@/server/profile/documents";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { LicenseStatus } from "@rebp/contracts";
import { LicenceAdminSheet } from "@/components/admin/licence-admin-sheet";
import { LicenceSearch } from "@/components/admin/licence-search";
import { PendingRegisterActions } from "@/components/admin/pending-register-actions";
import {
  ATTENTION_DOT,
  LIST_GROUP,
  LIST_ROW,
  LIST_ROW_HOVER,
  SOFT_PILL,
} from "@/components/admin/surfaces";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { PANEL, SELECTED } from "@/components/ui/surface";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  licenceAdminDetail,
  pendingRegisterQueue,
  requireAnyCapability,
  searchLicences,
} from "@/server/backoffice/admin-queries";
import { registerReport } from "@/server/backoffice/reports";
import { todayKigali } from "@/server/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("registerAdmin"))("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Register administration (WP-4.4, FR-RA-001/002): search licences, open one to see its status
 * history and act on it (suspend, lift, revoke, surrender, correct). Revocation is maker-checker:
 * approvers (register.revoke) apply or reject pending changes here.
 */
export default async function RegisterAdminPage({
  searchParams,
}: PageProps<"/backoffice/register">) {
  const { user, capabilities } = await requireAnyCapability([
    "register.administer",
    "register.revoke",
  ]);
  const params = (await searchParams) as SearchParams;
  const q = first(params.q)?.slice(0, 80);
  const page = Math.max(1, Number.parseInt(first(params.page) ?? "1", 10) || 1);
  const selectedId = first(params.licence);
  const canAdminister = capabilities.includes("register.administer");
  const canDecide = capabilities.includes("register.revoke");

  const [t, locale, list, pending, selected, report] = await Promise.all([
    getTranslations(),
    getLocale(),
    searchLicences({ q, page }),
    pendingRegisterQueue(),
    selectedId ? licenceAdminDetail(selectedId) : null,
    registerReport(),
  ]);
  const holderPhotos = await applicantPhotoUrls(
    list.items.flatMap((l) => (l.holderId ? [l.holderId] : [])),
  );

  const href = (updates: Record<string, string | null>) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (page > 1) search.set("page", String(page));
    for (const [key, value] of Object.entries(updates)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    const qs = search.toString();
    return (qs ? `/backoffice/register?${qs}` : "/backoffice/register") as Route;
  };

  const activeCount = report.byStatus.find((s) => s.key === "ACTIVE")?.count ?? 0;
  const decidable = canDecide ? pending.filter((row) => row.makerId !== user.id).length : 0;

  return (
    <>
      <PageWidth wide />
      <PageHeader
        eyebrow={t("registerAdmin.header.eyebrow")}
        title={t("registerAdmin.title")}
        description={t("registerAdmin.subtitle")}
        stats={[
          { value: activeCount, label: t("registerAdmin.header.active") },
          {
            value: report.expiring,
            label: t("registerAdmin.header.expiring"),
            tone: report.expiring > 0 ? "now" : "muted",
          },
          {
            value: pending.length,
            label: t("registerAdmin.header.pending"),
            tone: pending.length > 0 ? "now" : "muted",
          },
        ]}
        mood={pending.length > 0 ? "waiting" : "badge"}
        bubble={
          decidable > 0
            ? t("registerAdmin.header.bubbleDecide", { count: decidable })
            : pending.length > 0
              ? t("registerAdmin.header.bubbleWaiting")
              : t("registerAdmin.header.bubbleClear")
        }
      />

      {/* Maker-checker first (FR-RA-001): what an approver must decide stands above the register. */}
      {(pending.length > 0 || canDecide) && (
        <section aria-labelledby="pending-title" className={cn("flex flex-col gap-4", PANEL)}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {pending.length > 0 ? (
              <span aria-hidden className={ATTENTION_DOT} />
            ) : (
              <CircleCheck className="size-5 shrink-0 text-link" aria-hidden />
            )}
            <h2 id="pending-title" className="text-lg">
              {decidable > 0
                ? t("registerAdmin.pending.needsYou")
                : t("registerAdmin.pending.title")}
            </h2>
            <span className="ml-auto text-xs font-medium num text-muted-foreground">
              {t("registerAdmin.pending.count", { count: pending.length })}
            </span>
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("registerAdmin.pending.empty")}</p>
          ) : (
            <PendingRegisterActions rows={pending} canDecide={canDecide} currentUserId={user.id} />
          )}
        </section>
      )}

      <section aria-labelledby="licences-title" className={cn("flex flex-col gap-4", PANEL)}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="licences-title" className="text-lg">
            {t("registerAdmin.licences")}
          </h2>
          <p className="text-xs font-medium num text-muted-foreground" aria-live="polite">
            {t("registerAdmin.search.count", { count: list.total })}
          </p>
        </div>
        <LicenceSearch />

        {list.items.length === 0 ? (
          <EmptyState icon={SearchX} title={t("registerAdmin.search.empty")} />
        ) : (
          <ul className={LIST_GROUP}>
            {list.items.map((licence) => {
              const current = selectedId === licence.id;
              return (
                <li key={licence.id}>
                  <Link
                    href={href({ licence: licence.id })}
                    scroll={false}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "group flex min-h-16 items-center gap-3 text-sm outline-none focus-visible:bg-primary/[0.05]",
                      LIST_ROW,
                      current ? SELECTED : LIST_ROW_HOVER,
                    )}
                  >
                    {/* The holder's photo when there is one, else the category's two letters (UX-035). */}
                    <CategoryTile
                      category={licence.category}
                      photo={licence.holderId ? holderPhotos.get(licence.holderId) : null}
                      className="hidden @md/main:inline-flex"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-semibold">{licence.displayName}</span>
                        {licence.pending && (
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <span aria-hidden className={ATTENTION_DOT} />
                            <span className="@max-md/main:sr-only">
                              {t("registerAdmin.pending.awaiting")}
                            </span>
                          </span>
                        )}
                      </span>
                      <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-mono text-foreground/80">{licence.licenceNo}</span>
                        <span>{t(`categories.items.${licence.category}.name`)}</span>
                        <span className="font-mono @max-xl/main:hidden">
                          {licence.registrationNo}
                        </span>
                        {licence.firmName && (
                          <span className="@max-3xl/main:hidden">{licence.firmName}</span>
                        )}
                      </span>
                    </span>
                    <span className="hidden shrink-0 flex-col items-end gap-0.5 text-xs @xl/main:flex">
                      <span className="text-muted-foreground">
                        {t("registerAdmin.columns.expires")}
                      </span>
                      <span className="font-medium num">
                        {formatDay(licence.expiresAt, locale)}
                      </span>
                    </span>
                    <LicenceStatusBadge
                      status={licence.status as LicenseStatus}
                      className="@max-md/main:hidden"
                    />
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {list.pageCount > 1 && (
          <nav
            className="flex items-center justify-between gap-3"
            aria-label={t("registerAdmin.search.page", { page, count: list.pageCount })}
          >
            <Link
              href={href({ page: page > 2 ? String(page - 1) : null, licence: null })}
              aria-disabled={page <= 1}
              className={cn(SOFT_PILL, page <= 1 && "pointer-events-none opacity-50")}
            >
              <ChevronLeft aria-hidden /> {t("registerAdmin.search.prev")}
            </Link>
            <span className="text-sm num text-muted-foreground">
              {t("registerAdmin.search.page", { page, count: list.pageCount })}
            </span>
            <Link
              href={href({ page: String(page + 1), licence: null })}
              aria-disabled={page >= list.pageCount}
              className={cn(SOFT_PILL, page >= list.pageCount && "pointer-events-none opacity-50")}
            >
              {t("registerAdmin.search.next")} <ChevronRight aria-hidden />
            </Link>
          </nav>
        )}
      </section>

      {selected && (
        <LicenceAdminSheet
          key={selected.id}
          licence={selected}
          canAdminister={canAdminister}
          today={todayKigali()}
        />
      )}
    </>
  );
}
