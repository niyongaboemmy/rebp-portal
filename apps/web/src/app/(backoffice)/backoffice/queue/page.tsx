import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Gavel,
  Inbox,
  Timer,
  TriangleAlert,
  UserCheck,
  UserRound,
  Users,
} from "@/components/icons";
import { applicantPhotoUrls } from "@/server/profile/documents";
import { CategoryTile } from "@/components/applications/category-tile";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  QUEUE_VIEWS,
  queueQuerySchema,
  type ApplicationStatus,
  type Category,
} from "@rebp/contracts";
import { ApplicationStatusBadge } from "@/components/applications/status-badges";
import { AssignDialog } from "@/components/review/assign-dialog";
import { QueueRowCheck, QueueSelection } from "@/components/review/queue-selection";
import { QueueToolbar } from "@/components/review/queue-toolbar";
import { SlaBadge } from "@/components/review/sla-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { userCan } from "@/server/access/permissions";
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

const DAY_MS = 86_400_000;

/**
 * Work queues (WP-3.2, FR-BO-001…005): views as URL tabs, filters as chips (incl. the assigned
 * officer) and a sort, SLA state and time in state on every row, assign / reassign with the
 * conflict-of-interest guard (BR-093) and bulk assignment. Officers (review.perform) work the
 * queue; team leads (review.assign) reassign or take over any open file. Rows open the Section L
 * console at /backoffice/review/[id].
 */
export default async function QueuePage({ searchParams }: PageProps<"/backoffice/queue">) {
  const { user } = await requireCapability("backoffice.access");
  const [canPerform, canLead] = await Promise.all([
    userCan(user, "review.perform"),
    userCan(user, "review.assign"),
  ]);
  if (!canPerform && !canLead) redirect("/forbidden");
  const params = (await searchParams) as SearchParams;
  const query = queueQuerySchema.parse({
    view: first(params.view),
    status: first(params.status),
    category: first(params.category),
    type: first(params.type),
    q: first(params.q),
    officer: first(params.officer),
    sort: first(params.sort),
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
  // Applicants' profile photos for the rows (UX-035), one query for the page.
  const photos = await applicantPhotoUrls(result.items.map((i) => i.applicantId));
  const pageCount = Math.max(1, Math.ceil(result.total / QUEUE_PAGE_SIZE));
  const now = new Date();
  // FR-BO-002: leads may (re)assign any open file; officers unassigned work or their own.
  const ASSIGNABLE: readonly string[] = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "ACTION_REQUIRED",
    "FURTHER_ASSESSMENT",
  ];
  const mayAssign = (item: (typeof result.items)[number]) =>
    ASSIGNABLE.includes(item.status) &&
    (canLead || !item.assignedOfficerId || item.assignedOfficerId === user.id);
  // FR-BO-005: leads bulk-assign any open file; officers take unassigned ones.
  const selectable = result.items
    .filter((item) => ASSIGNABLE.includes(item.status) && (canLead || !item.assignedOfficerId))
    .map((item) => item.id);

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
      <PageHeader
        title={t("queue.title")}
        description={t("queue.subtitle")}
        tone={kpis.breached > 0 ? "danger" : undefined}
        mood={kpis.breached > 0 ? "worried" : result.mine > 0 ? "documents" : "celebrate"}
        bubble={
          kpis.breached > 0
            ? t("queue.bubble.breached")
            : result.mine > 0
              ? t("queue.bubble.mine")
              : t("queue.bubble.clear")
        }
        stats={[
          { value: result.mine, label: t("queue.kpi.mine"), tone: "primary" },
          {
            value: kpis.unassigned,
            label: t("queue.kpi.unassigned"),
            tone: kpis.unassigned > 0 ? "now" : "muted",
          },
          {
            value: kpis.breached,
            label: t("queue.kpi.breached"),
            tone: kpis.breached > 0 ? "now" : "muted",
          },
          {
            value: result.byStatus.PENDING_DECISION ?? 0,
            label: t("queue.kpi.decision"),
            tone: "muted",
          },
        ]}
      />

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
        <QueueToolbar counts={result.byStatus} officers={officers} selfId={user.id} />

        {result.items.length === 0 ? (
          <EmptyState
            icon={view === "mine" ? ClipboardCheck : Inbox}
            title={t(`queue.empty.${view}`)}
            description={
              query.q || query.status || query.category || query.type || query.officer
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
            <QueueSelection
              selectable={selectable}
              officers={officers}
              selfId={user.id}
              canLead={canLead}
            >
              <ul
                className="glass divide-y divide-foreground/[0.06] overflow-hidden rounded-[1.75rem] ring-1 ring-primary/[0.08] dark:divide-white/[0.06] dark:ring-white/[0.06]"
                data-testid="queue-list"
              >
                {result.items.map((item, index) => {
                  const sla = slaState(item, now);
                  const days = Math.floor((now.getTime() - item.inStateSince.getTime()) / DAY_MS);
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "relative flex animate-rise flex-col gap-3 p-4 transition-colors hover:bg-primary/[0.03] sm:flex-row sm:items-center sm:gap-4 sm:px-5 dark:hover:bg-surface-3/60",
                        sla === "breached" && "bg-danger-soft/40",
                      )}
                      style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}
                    >
                      {selectable.length > 0 && (
                        <QueueRowCheck id={item.id} reference={item.referenceNo} />
                      )}
                      <Link
                        href={`/backoffice/review/${item.id}` as Route}
                        className="group flex min-w-0 flex-1 flex-col gap-2 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 @2xl/main:grid @2xl/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] @2xl/main:items-center @2xl/main:gap-4"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          {/* The category as a two-letter tile; a yellow dot when nobody has it. */}
                          <CategoryTile
                            category={item.category as Category}
                            marker={!item.assignedOfficer}
                            photo={photos.get(item.applicantId)}
                          />
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-mono text-sm font-semibold group-hover:text-link">
                              {item.referenceNo}
                            </span>
                            <span className="truncate text-sm text-muted-foreground">
                              {item.applicant.fullName}
                            </span>
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
                          <span
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                            title={formatDay(item.inStateSince, locale)}
                            data-testid="queue-in-state"
                          >
                            <Timer className="size-3.5" aria-hidden />
                            {t("queue.inState", { days })}
                          </span>
                        </span>
                      </Link>
                      <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.06] pt-3 sm:w-56 sm:justify-end sm:border-t-0 sm:pt-0 dark:border-white/[0.06]">
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
                        {mayAssign(item) && (
                          <AssignDialog
                            applicationId={item.id}
                            reference={item.referenceNo}
                            currentOfficerId={item.assignedOfficerId}
                            officers={officers}
                            selfId={user.id}
                            compact
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </QueueSelection>
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
