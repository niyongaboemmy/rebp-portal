import {
  ChevronDown,
  ChevronRight,
  FileDown,
  Link2,
  ListFilter,
  Search,
  ShieldCheck,
  ShieldX,
  X,
} from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  LIST_GROUP,
  LIST_ROW,
  LIST_ROW_HOVER,
  PILL_TRACK,
  SOFT_PILL,
  pillClassName,
} from "@/components/admin/surfaces";
import { ColumnChart } from "@/components/data/column-chart";
import { ProgressRing } from "@/components/data/progress-ring";
import { TONE_SOFT_BG, TONE_TEXT } from "@/components/data/tones";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { PANEL } from "@/components/ui/surface";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  CATEGORY_ICONS,
  UNKNOWN_ACTION,
  actionLabelKey,
} from "@/config/audit-actions";
import { cn } from "@/lib/utils";
import { userCan } from "@/server/access/permissions";
import { verifyAuditChain } from "@/server/audit/audit";
import {
  filterQuery,
  hasFilters,
  parseAuditFilters,
  type AuditFilters,
} from "@/server/audit/filters";
import { auditTimeline, kigaliDay } from "@/server/audit/timeline";
import { requireCapability } from "@/server/auth/guards";
import { auditActivity } from "@/server/backoffice/overview";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("audit"))("title") };
}

function href(filters: AuditFilters, before?: string): Route {
  const query = filterQuery(filters, { before });
  return (query ? `/backoffice/audit?${query}` : "/backoffice/audit") as Route;
}

const FIELD_LABEL = "flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-muted-foreground";

/**
 * FR-AUD-001…004: the audit trail as a human timeline. Chain integrity and 14-day activity at a
 * glance; search by actor, entity or reference, action and Kigali date range, plus category pills,
 * all in the URL; events grouped by day with readable labels, the actor's name and role and an
 * icon; technical fields (entity, IP, hash) on demand. Cursor paging by id. Holders of
 * audit.export download the filtered events with a signed manifest.
 */
export default async function AuditPage({ searchParams }: PageProps<"/backoffice/audit">) {
  const { user } = await requireCapability("audit.view");
  const params = await searchParams;
  const filters = parseAuditFilters(params);
  const { category } = filters;
  const searched = hasFilters({ ...filters, category: undefined });
  const before =
    typeof params.before === "string" && /^\d+$/.test(params.before)
      ? BigInt(params.before)
      : undefined;

  const [t, format, chain, activity, { events, nextCursor }, canExport] = await Promise.all([
    getTranslations(),
    getFormatter(),
    verifyAuditChain(),
    auditActivity(),
    auditTimeline({ filters, before }),
    userCan(user, "audit.export"),
  ]);
  const exportHref = (format: "csv" | "json") =>
    `/api/exports/audit?${filterQuery(filters, { format: format === "json" ? "json" : undefined })}`;
  const roleLabel = (role: string | null) =>
    role
      ? role
          .split(",")
          .map((r) =>
            r === "SYSTEM"
              ? t("audit.system")
              : t.has(`roles.${r}`)
                ? t(`roles.${r}` as "roles.APPLICANT")
                : r,
          )
          .join(", ")
      : null;
  const now = new Date();
  const today = kigaliDay(now);
  const yesterday = kigaliDay(new Date(now.getTime() - 86_400_000));
  const dayTitle = (day: string) =>
    day === today
      ? t("audit.today")
      : day === yesterday
        ? t("audit.yesterday")
        : format.dateTime(new Date(`${day}T12:00:00Z`), {
            weekday: "long",
            day: "numeric",
            month: "long",
          });

  const groups: { day: string; events: typeof events }[] = [];
  for (const event of events) {
    const day = kigaliDay(event.occurredAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.events.push(event);
    else groups.push({ day, events: [event] });
  }

  const todayCount = activity.find((d) => d.day === today)?.count ?? 0;
  const fortnight = activity.reduce((sum, d) => sum + d.count, 0);

  return (
    <>
      <PageWidth wide />
      <PageHeader
        eyebrow={t("audit.header.eyebrow")}
        title={t("audit.title")}
        description={t("audit.subtitleShort")}
        tone={chain.ok ? undefined : "danger"}
        stats={[
          { value: chain.checked, label: t("audit.header.checked") },
          { value: todayCount, label: t("audit.header.today") },
          { value: fortnight, label: t("audit.header.fortnight"), tone: "muted" },
        ]}
        mood={chain.ok ? "shield" : "worried"}
        bubble={chain.ok ? t("audit.header.bubbleOk") : t("audit.header.bubbleBroken")}
        actions={
          canExport && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-full">
                <a href={exportHref("csv")} download data-testid="audit-export-csv">
                  <FileDown /> {t("audit.export.csv")}
                </a>
              </Button>
              <Button asChild variant="ghost" className="rounded-full">
                <a href={exportHref("json")} download data-testid="audit-export-json">
                  <FileDown /> {t("audit.export.json")}
                </a>
              </Button>
            </div>
          )
        }
      />

      <div className="grid items-stretch gap-4 @3xl/main:grid-cols-[1fr_1.6fr]">
        {/* Chain integrity: the one fact an auditor checks first (FR-AUD-003). */}
        <section
          aria-labelledby="chain-title"
          className={cn(
            "flex items-center gap-5",
            // .glass would win over a utility fill, so the broken state is its own surface.
            chain.ok
              ? PANEL
              : "rounded-[1.75rem] bg-danger-soft p-5 ring-1 ring-destructive/20 sm:p-6",
          )}
        >
          <ProgressRing
            value={chain.ok ? 1 : 0}
            total={1}
            tone={chain.ok ? "good" : "critical"}
            className="size-20 shrink-0"
            thickness={4}
          >
            {chain.ok ? (
              <ShieldCheck className="size-8 text-link" aria-hidden />
            ) : (
              <ShieldX className="size-8 text-destructive" aria-hidden />
            )}
          </ProgressRing>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="chain-title" className="text-lg">
              {chain.ok ? t("audit.chainIntact") : t("audit.chainBrokenTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {chain.ok
                ? t("audit.chainOk", { count: chain.checked })
                : t("audit.chainBroken", { id: String(chain.brokenAtId) })}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Link2 className="size-3.5" aria-hidden /> {t("audit.hashChained")}
            </span>
          </div>
        </section>

        <section
          aria-labelledby="volume-title"
          className={cn("flex min-w-0 flex-col gap-3", PANEL)}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="volume-title" className="text-lg">
              {t("backoffice.activityTitle")}
            </h2>
            <span className="text-xs text-muted-foreground">{t("backoffice.last14")}</span>
          </div>
          <ColumnChart
            label={t("backoffice.activityTitle")}
            valueLabel={t("backoffice.eventsUnit")}
            columns={activity.map((d) => ({
              key: d.day,
              label: format.dateTime(new Date(`${d.day}T12:00:00Z`), {
                day: "numeric",
                month: "short",
              }),
              value: d.count,
            }))}
          />
        </section>
      </div>

      <section aria-labelledby="events-title" className={cn("flex min-w-0 flex-col gap-5", PANEL)}>
        <div className="flex flex-col gap-3 @3xl/main:flex-row @3xl/main:items-center @3xl/main:justify-between">
          <h2 id="events-title" className="text-lg">
            {t("audit.header.events")}
          </h2>
          <nav aria-label={t("audit.filter")} className="flex min-w-0 items-center gap-2">
            <ListFilter
              className="hidden size-4 shrink-0 text-muted-foreground @xl/main:block"
              aria-hidden
            />
            <div className={PILL_TRACK}>
              <Link
                href={href({ ...filters, category: undefined })}
                aria-current={!category ? "true" : undefined}
                className={pillClassName(!category)}
              >
                {t("audit.all")}
              </Link>
              {AUDIT_CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICONS[c];
                return (
                  <Link
                    key={c}
                    href={href({ ...filters, category: c })}
                    aria-current={category === c ? "true" : undefined}
                    className={pillClassName(category === c)}
                  >
                    <Icon aria-hidden /> {t(`audit.categories.${c}`)}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>

        {/* FR-AUD-004 search: a plain GET form, so filters live in the URL and work without JS. */}
        <form
          method="get"
          action="/backoffice/audit"
          role="search"
          aria-label={t("audit.search.label")}
          className="grid grid-cols-1 items-end gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-[1.2fr_1.2fr_1fr_0.8fr_0.8fr_auto]"
        >
          {category && <input type="hidden" name="category" value={category} />}
          <label className={FIELD_LABEL}>
            {t("audit.search.actor")}
            <Input
              name="actor"
              type="search"
              defaultValue={filters.actor ?? ""}
              placeholder={t("audit.search.actorPlaceholder")}
              autoComplete="off"
            />
          </label>
          <label className={FIELD_LABEL}>
            {t("audit.search.entity")}
            <Input
              name="entity"
              type="search"
              defaultValue={filters.entity ?? ""}
              placeholder={t("audit.search.entityPlaceholder")}
              autoComplete="off"
            />
          </label>
          <label className={FIELD_LABEL}>
            {t("audit.search.action")}
            <Input
              name="action"
              type="search"
              defaultValue={filters.action ?? ""}
              placeholder={t("audit.search.actionPlaceholder")}
              autoComplete="off"
            />
          </label>
          <label className={FIELD_LABEL}>
            {t("audit.search.from")}
            <Input name="from" type="date" defaultValue={filters.from ?? ""} max={today} />
          </label>
          <label className={FIELD_LABEL}>
            {t("audit.search.to")}
            <Input name="to" type="date" defaultValue={filters.to ?? ""} max={today} />
          </label>
          <div className="flex gap-2 @xl/main:col-span-2 @5xl/main:col-span-1">
            <Button type="submit" className="h-12 flex-1 rounded-full @5xl/main:flex-none">
              <Search /> {t("audit.search.submit")}
            </Button>
            {searched && (
              <Button asChild variant="ghost" className="h-12 rounded-full">
                <Link href={href({ category })}>
                  <X /> {t("audit.search.clear")}
                </Link>
              </Button>
            )}
          </div>
        </form>
        {searched && (
          <p className="-mt-2 text-xs text-muted-foreground" aria-live="polite">
            {t("audit.search.results", { count: events.length, more: nextCursor ? "yes" : "no" })}
          </p>
        )}

        {groups.length === 0 ? (
          <EmptyState
            icon={ListFilter}
            title={searched ? t("audit.search.empty") : t("audit.empty")}
            className="py-10"
          />
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <section
                key={group.day}
                aria-labelledby={`day-${group.day}`}
                className="flex flex-col gap-2"
              >
                <h3
                  id={`day-${group.day}`}
                  className="flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground"
                >
                  {dayTitle(group.day)}
                  <span className="text-xs font-medium num text-muted-foreground/80">
                    · {group.events.length}
                  </span>
                </h3>
                <ol className={LIST_GROUP}>
                  {group.events.map((event) => {
                    const meta = AUDIT_ACTIONS[event.action] ?? UNKNOWN_ACTION;
                    const Icon = meta.icon;
                    const labelKey = actionLabelKey(event.action);
                    return (
                      <li key={event.id}>
                        <details className="group">
                          <summary
                            className={cn(
                              "flex cursor-pointer list-none items-center gap-3 outline-none focus-visible:bg-primary/[0.05] [&::-webkit-details-marker]:hidden",
                              LIST_ROW,
                              LIST_ROW_HOVER,
                            )}
                          >
                            <span
                              className={cn(
                                "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                                TONE_SOFT_BG[meta.tone],
                                TONE_TEXT[meta.tone],
                              )}
                            >
                              <Icon className="size-4" aria-hidden />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm font-semibold">
                                {t.has(labelKey)
                                  ? t(labelKey as "auditActions.auth_signin")
                                  : event.action}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {event.actorName ?? t("audit.system")}
                                {event.actorName && event.actorRole
                                  ? ` · ${roleLabel(event.actorRole)}`
                                  : ""}
                              </span>
                            </span>
                            <time
                              dateTime={event.occurredAt.toISOString()}
                              className="shrink-0 text-xs font-medium num text-muted-foreground"
                            >
                              {format.dateTime(event.occurredAt, {
                                timeStyle: "short",
                                timeZone: "Africa/Kigali",
                              })}
                            </time>
                            <ChevronDown
                              className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-2) group-open:rotate-180"
                              aria-hidden
                            />
                          </summary>
                          <dl className="grid animate-rise grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 bg-foreground/[0.025] px-3.5 py-3 text-xs @xl/main:pl-15 dark:bg-white/[0.03]">
                            <dt className="text-muted-foreground">{t("audit.columns.action")}</dt>
                            <dd className="font-mono break-all">{event.action}</dd>
                            <dt className="text-muted-foreground">{t("audit.columns.entity")}</dt>
                            <dd className="font-mono break-all">
                              {event.entityType}
                              {event.entityId ? `:${event.entityId}` : ""}
                            </dd>
                            <dt className="text-muted-foreground">{t("audit.columns.ip")}</dt>
                            <dd className="font-mono">{event.ipAddress ?? "—"}</dd>
                            <dt className="text-muted-foreground">{t("audit.columns.hash")}</dt>
                            <dd className="font-mono break-all">{event.hash}</dd>
                          </dl>
                        </details>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}

        {(before || nextCursor) && (
          <div className="flex flex-wrap justify-center gap-2">
            {before && (
              <Link href={href(filters)} className={SOFT_PILL}>
                {t("audit.newest")}
              </Link>
            )}
            {nextCursor && (
              <Link href={href(filters, nextCursor)} className={SOFT_PILL}>
                {t("audit.older")} <ChevronRight aria-hidden />
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}
