import { BadgeCheck, ChevronLeft, ChevronRight, Hourglass, SearchX } from "@/components/icons";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { LicenseStatus } from "@rebp/contracts";
import { LicenceAdminSheet } from "@/components/admin/licence-admin-sheet";
import { LicenceSearch } from "@/components/admin/licence-search";
import { PendingRegisterActions } from "@/components/admin/pending-register-actions";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/format";
import {
  licenceAdminDetail,
  pendingRegisterQueue,
  requireAnyCapability,
  searchLicences,
} from "@/server/backoffice/admin-queries";
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

  const [t, locale, list, pending, selected] = await Promise.all([
    getTranslations(),
    getLocale(),
    searchLicences({ q, page }),
    pendingRegisterQueue(),
    selectedId ? licenceAdminDetail(selectedId) : null,
  ]);

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

  return (
    <>
      <PageWidth wide />
      <PageHeader title={t("registerAdmin.title")} description={t("registerAdmin.subtitle")} />

      {(pending.length > 0 || canDecide) && (
        <section aria-labelledby="pending-title" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="pending-title" className="text-lg">
              {t("registerAdmin.pending.title")}
            </h2>
            <span className="text-xs text-muted-foreground">
              {t("registerAdmin.pending.count", { count: pending.length })}
            </span>
          </div>
          {pending.length === 0 ? (
            <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
              {t("registerAdmin.pending.empty")}
            </p>
          ) : (
            <PendingRegisterActions rows={pending} canDecide={canDecide} currentUserId={user.id} />
          )}
        </section>
      )}

      <section aria-labelledby="licences-title" className="flex flex-col gap-4">
        <h2 id="licences-title" className="text-lg">
          {t("registerAdmin.licences")}
        </h2>
        <LicenceSearch />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("registerAdmin.search.count", { count: list.total })}
        </p>

        {list.items.length === 0 ? (
          <EmptyState icon={SearchX} title={t("registerAdmin.search.empty")} />
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl border bg-card raised">
            {list.items.map((licence) => (
              <li key={licence.id} className="border-b last:border-b-0">
                <Link
                  href={href({ licence: licence.id })}
                  scroll={false}
                  aria-current={selectedId === licence.id ? "true" : undefined}
                  className="group flex items-start gap-3 px-4 py-3 transition-colors outline-none hover:bg-surface-2 focus-visible:bg-surface-2 aria-[current]:bg-primary/[0.05] sm:items-center"
                >
                  <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground xs:inline-flex">
                    <BadgeCheck className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-semibold">{licence.displayName}</span>
                      <LicenceStatusBadge status={licence.status as LicenseStatus} />
                      {licence.pending && (
                        <Badge variant="warning">
                          <Hourglass aria-hidden /> {t("registerAdmin.pending.awaiting")}
                        </Badge>
                      )}
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="font-mono text-foreground/80">{licence.licenceNo}</span>
                      <span>{t(`categories.items.${licence.category}.name`)}</span>
                      <span className="font-mono">{licence.registrationNo}</span>
                      {licence.firmName && <span>{licence.firmName}</span>}
                    </span>
                  </span>
                  <span className="hidden shrink-0 flex-col items-end gap-0.5 text-xs sm:flex">
                    <span className="text-muted-foreground">
                      {t("registerAdmin.columns.expires")}
                    </span>
                    <span className="font-medium num">{formatDay(licence.expiresAt, locale)}</span>
                  </span>
                  <ChevronRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:mt-0"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {list.pageCount > 1 && (
          <nav
            className="flex items-center justify-between gap-3"
            aria-label={t("registerAdmin.search.page", { page, count: list.pageCount })}
          >
            <Button
              asChild
              variant="outline"
              size="sm"
              className={page <= 1 ? "pointer-events-none opacity-50" : ""}
            >
              <Link
                href={href({ page: page > 2 ? String(page - 1) : null, licence: null })}
                aria-disabled={page <= 1}
              >
                <ChevronLeft /> {t("registerAdmin.search.prev")}
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("registerAdmin.search.page", { page, count: list.pageCount })}
            </span>
            <Button
              asChild
              variant="outline"
              size="sm"
              className={page >= list.pageCount ? "pointer-events-none opacity-50" : ""}
            >
              <Link
                href={href({ page: String(page + 1), licence: null })}
                aria-disabled={page >= list.pageCount}
              >
                {t("registerAdmin.search.next")} <ChevronRight />
              </Link>
            </Button>
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
