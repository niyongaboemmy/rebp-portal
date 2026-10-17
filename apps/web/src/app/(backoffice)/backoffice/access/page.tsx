import { ChevronLeft, ChevronRight, KeySquare, Users } from "@/components/icons";
import { applicantPhotoUrls } from "@/server/profile/documents";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { userQuerySchema } from "@rebp/contracts";
import { PeopleList } from "@/components/access/people-list";
import { LIST_GROUP, SOFT_PILL } from "@/components/admin/surfaces";
import { PeopleToolbar } from "@/components/access/people-toolbar";
import { PermissionMatrixEditor } from "@/components/access/permission-matrix";
import { StepUpProvider } from "@/components/security/step-up";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PANEL } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { getPermissionMatrix, userCan } from "@/server/access/permissions";
import { listUsers, roleCounts } from "@/server/access/users";
import { requireCapability } from "@/server/auth/guards";
import { accountStats } from "@/server/backoffice/overview";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("access"))("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** SEC-004 / SEC-011: people, roles and the permission matrix in one console. */
export default async function AccessControlPage({ searchParams }: PageProps<"/backoffice/access">) {
  const { user } = await requireCapability("access.view");
  const params = (await searchParams) as SearchParams;
  const tab = first(params.tab) === "roles" ? "roles" : "people";
  const [t, canManageUsers, canManageRoles, accounts] = await Promise.all([
    getTranslations("access"),
    userCan(user, "users.manage"),
    userCan(user, "roles.manage"),
    accountStats(),
  ]);
  const readOnly = tab === "people" ? !canManageUsers : !canManageRoles;
  const withoutTwoStep = Math.max(0, accounts.total - accounts.withTwoStep);

  return (
    <StepUpProvider hasPassword={Boolean(user.passwordHash)}>
      <PageWidth wide />
      <PageHeader
        eyebrow={t("header.eyebrow")}
        title={t("title")}
        description={t("subtitle")}
        stats={[
          { value: accounts.total, label: t("header.people") },
          { value: accounts.withTwoStep, label: t("header.twoStep") },
          {
            value: withoutTwoStep,
            label: t("header.noTwoStep"),
            tone: withoutTwoStep > 0 ? "now" : "muted",
          },
        ]}
        mood="lock"
        bubble={readOnly ? t("header.bubbleReadOnly") : t("header.bubble")}
      />
      <LinkTabs
        label={t("title")}
        tabs={[
          {
            href: "/backoffice/access" as Route,
            label: t("tabs.people"),
            icon: <Users />,
            active: tab === "people",
          },
          {
            href: "/backoffice/access?tab=roles" as Route,
            label: t("tabs.roles"),
            icon: <KeySquare />,
            active: tab === "roles",
          },
        ]}
      />
      {readOnly && <Alert variant="info">{t("readOnly")}</Alert>}

      {tab === "people" ? (
        <section className={cn("flex min-w-0 flex-col gap-5", PANEL)} aria-label={t("tabs.people")}>
          <PeopleToolbar />
          <Suspense key={JSON.stringify(params)} fallback={<PeopleSkeleton />}>
            <People params={params} currentUserId={user.id} canManage={canManageUsers} />
          </Suspense>
        </section>
      ) : (
        <section className={cn("flex min-w-0 flex-col gap-2", PANEL)} aria-label={t("tabs.roles")}>
          <div className="mb-2">
            <h2 className="text-lg">{t("matrix.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("matrix.subtitle")}</p>
          </div>
          <PermissionMatrixEditor
            matrix={await getPermissionMatrix()}
            roleCounts={await roleCounts()}
            canEdit={canManageRoles}
          />
        </section>
      )}
    </StepUpProvider>
  );
}

async function People({
  params,
  currentUserId,
  canManage,
}: {
  params: SearchParams;
  currentUserId: string;
  canManage: boolean;
}) {
  const t = await getTranslations("access.people");
  const query = userQuerySchema.parse({
    q: first(params.q),
    role: first(params.role),
    status: first(params.status),
    page: first(params.page),
  });
  const [{ items, total, page, pageCount }, matrix] = await Promise.all([
    listUsers(query),
    getPermissionMatrix(),
  ]);

  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const v = first(value);
      if (v && key !== "page") search.set(key, v);
    }
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return (qs ? `/backoffice/access?${qs}` : "/backoffice/access") as Route;
  };

  if (items.length === 0) return <EmptyState icon={Users} title={t("empty")} className="py-10" />;

  return (
    <div className="flex flex-col gap-4">
      <p
        className="text-xs font-medium num text-muted-foreground"
        aria-live="polite"
        data-testid="people-count"
      >
        {t("count", { count: total })}
      </p>
      <PeopleList
        users={items}
        currentUserId={currentUserId}
        matrix={matrix}
        canManage={canManage}
        photos={Object.fromEntries(await applicantPhotoUrls(items.map((u) => u.id)))}
      />
      {pageCount > 1 && (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label={t("page", { page, count: pageCount })}
        >
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={cn(SOFT_PILL, page <= 1 && "pointer-events-none opacity-50")}
          >
            <ChevronLeft aria-hidden /> {t("prev")}
          </Link>
          <span className="text-sm num text-muted-foreground">
            {t("page", { page, count: pageCount })}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= pageCount}
            className={cn(SOFT_PILL, page >= pageCount && "pointer-events-none opacity-50")}
          >
            {t("next")} <ChevronRight aria-hidden />
          </Link>
        </nav>
      )}
    </div>
  );
}

function PeopleSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <Skeleton className="h-3 w-20" />
      <div className={LIST_GROUP}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3.5 py-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
