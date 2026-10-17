import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Gavel,
  Inbox,
  TriangleAlert,
  UserCheck,
  UserRound,
  Users,
} from "@/components/icons";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { QUEUE_VIEWS, queueQuerySchema, type ApplicationStatus } from "@rebp/contracts";
import { ApplicationStatusBadge } from "@/components/applications/status-badges";
import { StatTile } from "@/components/data/stat-tile";
import { AssignDialog } from "@/components/review/assign-dialog";
import { QueueToolbar } from "@/components/review/queue-toolbar";
import { SlaBadge } from "@/components/review/sla-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/format";
import { requireCapability } from "@/server/auth/guards";
import { reviewers } from "@/server/backoffice/assignment";
import { queue, QUEUE_PAGE_SIZE } from "@/server/backoffice/queue";
import { queueKpis } from "@/server/backoffice/review-queries";
import { slaState } from "@/server/backoffice/review";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("queue"))("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const VIEW_ICONS = {
  mine: UserCheck,
  unassigned: Inbox,
  all: Users,
  sla: TriangleAlert,
  decision: Gavel,
} as const;

/**
 * Work queues (WP-3.2, FR-BO-001…004): views as URL tabs, filters as chips, SLA state on every
 * row, assign / reassign with the conflict-of-interest guard (BR-093). Rows open the Section L
 * console at /backoffice/review/[id].
 */
export default async function QueuePage({ searchParams }: PageProps<"/backoffice/queue">) {
  const { user } = await requireCapability("review.perform");
  const params = (await searchParams) as SearchParams;
  const query = queueQuerySchema.parse({
    view: first(params.view),
    status: first(params.status),
    category: first(params.category),
    type: first(params.type),
    q: first(params.q),
    page: first(params.page),
  });
  const view = query.view ?? "mine";
  const [t, locale, result, kpis, officers] = await Promise.all([
    getTranslations(),
    getLocale(),
    queue(query, user),
    queueKpis(),
    reviewers(),
  ]);
  const pageCount = Math.max(1, Math.ceil(result.total / QUEUE_PAGE_SIZE));
  const now = new Date();

  const href = (updates: Record<string, string | null>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const v = first(value);
      if (v && key !== "page") search.set(key, v);
    }
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) search.delete(key);
      else search.set(key, value);
    }
    const qs = search.toString();
    return (qs ? `/backoffice/queue?${qs}` : "/backoffice/queue") as Route;
  };

  return (
    <>
      <PageWidth wide />
      <PageHeader title={t("queue.title")} description={t("queue.subtitle")} />

      <section
        aria-label={t("queue.kpis")}
        className="grid grid-cols-2 gap-3 sm:gap-4 @5xl/main:grid-cols-4"
      >
        <StatTile
          icon={UserCheck}
          label={t("queue.kpi.mine")}
          value={result.mine}
          hint={t("queue.kpi.mineHint")}
          href={"/backoffice/queue?view=mine" as Route}
        />
        <StatTile
          icon={Inbox}
          label={t("queue.kpi.unassigned")}
          value={kpis.unassigned}
          hint={t("queue.kpi.unassignedHint")}
          href={"/backoffice/queue?view=unassigned" as Route}
        />
        <StatTile
          icon={TriangleAlert}
          label={t("queue.kpi.breached")}
          value={kpis.breached}
          hint={t("queue.kpi.breachedHint")}
          href={"/backoffice/queue?view=sla" as Route}
        />
        <StatTile
          icon={Gavel}
          label={t("queue.kpi.decision")}
          value={result.byStatus.PENDING_DECISION ?? 0}
          hint={t("queue.kpi.decisionHint")}
          href={"/backoffice/queue?view=decision" as Route}
        />
      </section>

      <div className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <LinkTabs
          label={t("queue.views")}
          className="w-max min-w-full sm:min-w-0"
          tabs={QUEUE_VIEWS.map((v) => {
            const Icon = VIEW_ICONS[v];
            return {
              href: href({ view: v === "mine" ? null : v }),
              label: t(`queue.view.${v}`),
              icon: <Icon />,
              active: view === v,
            };
          })}
        />
      </div>

      <section aria-label={t("queue.results")} className="flex flex-col gap-4">
        <QueueToolbar counts={result.byStatus} />

        {result.items.length === 0 ? (
          <EmptyState
            icon={view === "mine" ? ClipboardCheck : Inbox}
            title={t(`queue.empty.${view}`)}
            description={
              query.q || query.status || query.category || query.type
                ? t("queue.emptyFiltered")
                : t("queue.emptyHint")
            }
          />
        ) : (
          <>
            <p
              className="text-sm text-muted-foreground"
              aria-live="polite"
              data-testid="queue-count"
            >
              {t("queue.count", { count: result.total })}
            </p>
            <ul className="flex flex-col gap-2.5" data-testid="queue-list">
              {result.items.map((item, index) => {
                const sla = slaState(item, now);
                return (
                  <li
                    key={item.id}
                    className="flex animate-rise flex-col gap-3 rounded-2xl border bg-card p-4 raised sm:flex-row sm:items-center sm:gap-4"
                    style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}
                  >
                    <Link
                      href={`/backoffice/review/${item.id}` as Route}
                      className="group flex min-w-0 flex-1 flex-col gap-2 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 @2xl/main:grid @2xl/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] @2xl/main:items-center @2xl/main:gap-4"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-mono text-sm font-semibold group-hover:text-link">
                          {item.referenceNo}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {item.applicant.fullName}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5 text-sm">
                        <span className="truncate font-medium">
                          {t(`categories.items.${item.category}.name`)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {t(`applicationTypes.${item.type}.name`)}
                          {item.submittedAt &&
                            ` · ${t("queue.submitted", { date: formatDay(item.submittedAt, locale) })}`}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ApplicationStatusBadge status={item.status as ApplicationStatus} />
                        <SlaBadge
                          state={sla}
                          due={item.slaDueAt ? formatDay(item.slaDueAt, locale) : undefined}
                        />
                      </span>
                    </Link>
                    <div className="flex items-center justify-between gap-3 border-t pt-3 sm:w-56 sm:justify-end sm:border-t-0 sm:pt-0">
                      {item.assignedOfficer ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm">
                          <UserRound
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="sr-only">{t("queue.officer")}: </span>
                          <span className="truncate">
                            {item.assignedOfficer.id === user.id
                              ? t("queue.you")
                              : item.assignedOfficer.fullName}
                          </span>
                        </span>
                      ) : (
                        <Badge variant="warning">{t("queue.unassigned")}</Badge>
                      )}
                      <AssignDialog
                        applicationId={item.id}
                        reference={item.referenceNo}
                        currentOfficerId={item.assignedOfficerId}
                        officers={officers}
                        selfId={user.id}
                        compact
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            {pageCount > 1 && (
              <nav
                className="flex items-center justify-between gap-3"
                aria-label={t("queue.page", { page: result.page, count: pageCount })}
              >
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={result.page <= 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <Link
                    href={href({ page: result.page - 1 > 1 ? String(result.page - 1) : null })}
                    aria-disabled={result.page <= 1}
                  >
                    <ChevronLeft /> {t("queue.prev")}
                  </Link>
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("queue.page", { page: result.page, count: pageCount })}
                </span>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={result.page >= pageCount ? "pointer-events-none opacity-50" : ""}
                >
                  <Link
                    href={href({ page: String(result.page + 1) })}
                    aria-disabled={result.page >= pageCount}
                  >
                    {t("queue.next")} <ChevronRight />
                  </Link>
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
    </>
  );
}
