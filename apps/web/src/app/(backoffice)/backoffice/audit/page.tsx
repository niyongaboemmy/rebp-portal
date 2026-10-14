import {
  ChevronDown,
  ChevronRight,
  Link2,
  ListFilter,
  ShieldCheck,
  ShieldX,
} from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { ColumnChart } from "@/components/data/column-chart";
import { ProgressRing } from "@/components/data/progress-ring";
import { TONE_SOFT_BG, TONE_TEXT } from "@/components/data/tones";
import { chipClassName, ChipRow } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  CATEGORY_ICONS,
  UNKNOWN_ACTION,
  actionLabelKey,
  isAuditCategory,
  type AuditCategory,
} from "@/config/audit-actions";
import { cn } from "@/lib/utils";
import { verifyAuditChain } from "@/server/audit/audit";
import { auditTimeline, kigaliDay } from "@/server/audit/timeline";
import { requireCapability } from "@/server/auth/guards";
import { auditActivity } from "@/server/backoffice/overview";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("audit"))("title") };
}

function href(params: { category?: AuditCategory; before?: string }): Route {
  const query = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();
  return (query ? `/backoffice/audit?${query}` : "/backoffice/audit") as Route;
}

/**
 * FR-AUD-001…004: the audit trail as a human timeline. Chain integrity and 14-day activity at a
 * glance, category filters in the URL, events grouped by day with readable labels, the actor's
 * name and an icon; technical fields (entity, IP, hash) on demand. Cursor paging by id.
 */
export default async function AuditPage({ searchParams }: PageProps<"/backoffice/audit">) {
  await requireCapability("audit.view");
  const params = await searchParams;
  const category = isAuditCategory(params.category) ? params.category : undefined;
  const before =
    typeof params.before === "string" && /^\d+$/.test(params.before)
      ? BigInt(params.before)
      : undefined;

  const [t, format, chain, activity, { events, nextCursor }] = await Promise.all([
    getTranslations(),
    getFormatter(),
    verifyAuditChain(),
    auditActivity(),
    auditTimeline({ category, before }),
  ]);
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

  return (
    <>
      <PageHeader title={t("audit.title")} description={t("audit.subtitleShort")} />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.6fr]">
        {/* Chain integrity: the one fact an auditor checks first (FR-AUD-003). */}
        <section
          aria-labelledby="chain-title"
          className={cn(
            "flex items-center gap-5 rounded-3xl border p-5 raised sm:p-6",
            chain.ok ? "bg-card" : "bg-danger-soft",
          )}
        >
          <ProgressRing
            value={chain.ok ? 1 : 0}
            total={1}
            tone={chain.ok ? "good" : "critical"}
            className="size-20"
            thickness={4}
          >
            {chain.ok ? (
              <ShieldCheck className="size-8 text-success" aria-hidden />
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
          className="flex flex-col gap-3 rounded-3xl border bg-card p-5 raised sm:p-6"
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

      <nav aria-label={t("audit.filter")} className="flex items-center gap-2">
        <ListFilter className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
        <ChipRow>
          <Link
            href={href({})}
            aria-current={!category ? "true" : undefined}
            className={chipClassName(!category)}
          >
            {t("audit.all")}
          </Link>
          {AUDIT_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c];
            return (
              <Link
                key={c}
                href={href({ category: c })}
                aria-current={category === c ? "true" : undefined}
                className={chipClassName(category === c)}
              >
                <Icon aria-hidden /> {t(`audit.categories.${c}`)}
              </Link>
            );
          })}
        </ChipRow>
      </nav>

      {groups.length === 0 ? (
        <EmptyState icon={ListFilter} title={t("audit.empty")} />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section
              key={group.day}
              aria-labelledby={`day-${group.day}`}
              className="flex flex-col gap-2"
            >
              <h2
                id={`day-${group.day}`}
                className="sticky top-16 z-10 -mx-1 bg-background/90 px-1 py-1.5 text-sm font-semibold text-muted-foreground backdrop-blur"
              >
                {dayTitle(group.day)}
              </h2>
              <ol className="flex flex-col overflow-hidden rounded-2xl border bg-card raised">
                {group.events.map((event) => {
                  const meta = AUDIT_ACTIONS[event.action] ?? UNKNOWN_ACTION;
                  const Icon = meta.icon;
                  const labelKey = actionLabelKey(event.action);
                  return (
                    <li key={event.id} className="border-b last:border-b-0">
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
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
                        <dl className="grid animate-rise grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 bg-surface-2 px-4 py-3 pl-16 text-xs">
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

      <div className="flex flex-wrap justify-center gap-2">
        {before && (
          <Link href={href({ category })} className={chipClassName(false)}>
            {t("audit.newest")}
          </Link>
        )}
        {nextCursor && (
          <Link href={href({ category, before: nextCursor })} className={chipClassName(false)}>
            {t("audit.older")} <ChevronRight aria-hidden />
          </Link>
        )}
      </div>
    </>
  );
}
