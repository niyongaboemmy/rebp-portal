import type { Metadata, Route } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { HealthPanel } from "@/components/admin/health-panel";
import { CommandStrip, type WaitingSlice } from "@/components/dashboard/command-strip";
import { FlowPanel } from "@/components/dashboard/flow-panel";
import { GuideStrip, type GuideItem } from "@/components/dashboard/guide-strip";
import {
  ActivityPanel,
  DecisionsPanel,
  SecurityPanel,
  SlaPanel,
} from "@/components/dashboard/insight-panels";
import { KpiCard } from "@/components/dashboard/kpi-card";
import type { DashLinks } from "@/components/dashboard/links";
import { PipelinePanel } from "@/components/dashboard/pipeline-panel";
import { PageWidth } from "@/components/layout/page-width";
import { BACKOFFICE_SECTIONS, canSee } from "@/config/navigation";
import { userCapabilities } from "@/server/access/permissions";
import { requireCapability } from "@/server/auth/guards";
import { consoleCounts } from "@/server/backoffice/admin-queries";
import {
  accountStats,
  auditActivity,
  decisionMix,
  flowSeries,
  myOverdue,
  pipelineCounts,
  pipelineDetail,
  slaHealth,
} from "@/server/backoffice/overview";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("backoffice") };
}

type Focus = "overdue" | "decisions" | "queue" | "register" | "configuration";

const FOCUS_HREF: Record<Focus, Route> = {
  overdue: "/backoffice/queue?view=sla" as Route,
  decisions: "/backoffice/decisions" as Route,
  queue: "/backoffice/queue" as Route,
  register: "/backoffice/register" as Route,
  configuration: "/backoffice/configuration" as Route,
};

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

/**
 * Back-office overview, v2 (FR-RPT-001, FR-ADM-005; UX-040). A bento of live, interactive graphics
 * instead of paragraphs: the command strip (what waits and the one next action), four pulse KPIs
 * with trends, the flow of work in and out, the pipeline, deadline health, decisions, security and
 * activity. Every tile summarises; its dialog holds the detail. Data is role-gated by capability and
 * refreshes itself every minute while the tab is visible.
 */
export default async function BackofficeOverview() {
  const { user } = await requireCapability("backoffice.access");
  const [t, format, capabilities] = await Promise.all([
    getTranslations(),
    getFormatter(),
    userCapabilities(user),
  ]);
  const canSeeAccounts = capabilities.includes("access.view");
  const canSeeAudit = capabilities.includes("audit.view");
  const canSeeApplications = capabilities.includes("review.view");
  const reviews = capabilities.includes("review.perform");

  const [counts, overdue, flow, pipeline, stages, sla, mix, accounts, activity] = await Promise.all(
    [
      consoleCounts(user.id, capabilities),
      reviews ? myOverdue(user.id) : 0,
      canSeeApplications ? flowSeries(30) : null,
      canSeeApplications ? pipelineCounts() : null,
      canSeeApplications ? pipelineDetail() : null,
      canSeeApplications ? slaHealth() : null,
      canSeeApplications ? decisionMix(30) : null,
      canSeeAccounts ? accountStats() : null,
      canSeeAudit ? auditActivity(30) : null,
    ],
  );

  // Where each element leads, only into consoles this person can open (capability-filtered).
  const allowed = (slug: keyof typeof BACKOFFICE_SECTIONS) =>
    canSee(BACKOFFICE_SECTIONS[slug], capabilities);
  const route = (path: string) => path as Route;
  const q = allowed("queue");
  const canAccess = capabilities.includes("access.view");
  const links: DashLinks = {
    queueSla: q ? route("/backoffice/queue?view=sla") : undefined,
    queueMine: q ? route("/backoffice/queue?view=mine") : undefined,
    queueAll: q ? route("/backoffice/queue?view=all") : undefined,
    queueDeadline: q ? route("/backoffice/queue?view=all&sort=deadline") : undefined,
    queueNewest: q ? route("/backoffice/queue?view=all&sort=submitted") : undefined,
    queueUnassigned: q ? route("/backoffice/queue?view=unassigned") : undefined,
    queueStatus: q ? "/backoffice/queue?view=all&sort=stale&status=" : undefined,
    queueSearch: q ? "/backoffice/queue?view=all&q=" : undefined,
    decisions: allowed("decisions") ? route("/backoffice/decisions") : undefined,
    register: allowed("register") ? route("/backoffice/register") : undefined,
    configuration: allowed("configuration") ? route("/backoffice/configuration") : undefined,
    reports: allowed("reports") ? route("/backoffice/reports") : undefined,
    accessNoMfa: canAccess ? route("/backoffice/access?status=noMfa") : undefined,
    accessActive: canAccess ? route("/backoffice/access?status=active") : undefined,
    accessRole: canAccess ? "/backoffice/access?role=" : undefined,
    audit: capabilities.includes("audit.view") ? route("/backoffice/audit") : undefined,
  };

  // What waits for this person, by where it waits (overdue files are part of their queue).
  const queue = counts.queue ?? 0;
  const waiting: WaitingSlice[] = [
    { key: "overdue", count: overdue, href: links.queueSla },
    { key: "queue", count: Math.max(0, queue - overdue), href: links.queueMine },
    { key: "decisions", count: counts.decisions ?? 0, href: links.decisions },
    { key: "register", count: counts.register ?? 0, href: links.register },
    { key: "configuration", count: counts.configuration ?? 0, href: links.configuration },
  ];
  const focusKey: Focus | null =
    overdue > 0
      ? "overdue"
      : (counts.decisions ?? 0) > 0
        ? "decisions"
        : queue > 0
          ? "queue"
          : (counts.register ?? 0) > 0
            ? "register"
            : (counts.configuration ?? 0) > 0
              ? "configuration"
              : null;
  const focusCount = focusKey === "overdue" ? overdue : focusKey ? (counts[focusKey] ?? 0) : 0;
  const focus = focusKey
    ? {
        title: t(`backoffice.hero.focus.${focusKey}.title`, { count: focusCount }),
        cta: t(`backoffice.hero.focus.${focusKey}.cta`),
        href: FOCUS_HREF[focusKey],
        danger: focusKey === "overdue",
      }
    : null;

  // Pulse KPIs from the 30-day flow: this week against the week before.
  const dayLabel = (day: string) =>
    format.dateTime(new Date(`${day}T12:00:00Z`), { day: "numeric", month: "short" });
  const last14 = flow?.slice(-14) ?? [];
  const labels14 = last14.map((d) => dayLabel(d.day));
  const inWeek = sum(flow?.slice(-7).map((d) => d.submitted) ?? []);
  const inPrev = sum(flow?.slice(-14, -7).map((d) => d.submitted) ?? []);
  const outWeek = sum(flow?.slice(-7).map((d) => d.decided) ?? []);
  const outPrev = sum(flow?.slice(-14, -7).map((d) => d.decided) ?? []);
  // Open files over time, walked back from today's count with each day's net flow.
  const openNow = pipeline ? sum(Object.values(pipeline.counts)) : 0;
  const openSeries: number[] = [];
  {
    let open = openNow;
    for (let i = last14.length - 1; i >= 0; i--) {
      openSeries.unshift(Math.max(0, open));
      open -= last14[i]!.submitted - last14[i]!.decided;
    }
  }

  // "Do now": data-driven nudges, most urgent first, at most three (UX-040).
  const net = inWeek - outWeek;
  const twoStepShare =
    accounts && accounts.total > 0
      ? Math.round((accounts.withTwoStep / accounts.total) * 100)
      : 100;
  const nudges: (GuideItem | null)[] = [
    sla && sla.overdue > 0
      ? {
          key: "overdue",
          tone: "critical",
          icon: "overdue",
          text: t("boDash.guide.overdue", { count: sla.overdue }),
          cta: t("boDash.actions.reviewOverdue"),
          href: links.queueSla,
        }
      : null,
    sla && sla.dueSoon > 0
      ? {
          key: "due",
          tone: "warning",
          icon: "due",
          text: t("boDash.guide.dueSoon", { count: sla.dueSoon }),
          cta: t("boDash.actions.planDue"),
          href: links.queueDeadline,
        }
      : null,
    (counts.decisions ?? 0) > 0
      ? {
          key: "decide",
          tone: "waiting",
          icon: "decide",
          text: t("boDash.guide.decisions", { count: counts.decisions ?? 0 }),
          cta: t("boDash.command.act.decisions", { count: counts.decisions ?? 0 }),
          href: links.decisions,
        }
      : null,
    flow && net > 0
      ? {
          key: "backlog",
          tone: "warning",
          icon: "backlog",
          text: t("boDash.guide.backlog", { count: net }),
          cta: t("boDash.flow.assign"),
          href: links.queueUnassigned,
        }
      : null,
    pipeline && pipeline.counts.ACTION_REQUIRED > 0
      ? {
          key: "applicant",
          tone: "warning",
          icon: "applicant",
          text: t("boDash.guide.applicants", { count: pipeline.counts.ACTION_REQUIRED }),
          cta: t("boDash.actions.viewStage", { count: pipeline.counts.ACTION_REQUIRED }),
          href: links.queueStatus ? route(`${links.queueStatus}ACTION_REQUIRED`) : undefined,
        }
      : null,
    accounts && twoStepShare < 80
      ? {
          key: "security",
          tone: "warning",
          icon: "security",
          text: t("boDash.guide.twoStep", { share: twoStepShare }),
          cta: t("boDash.security.remind"),
          href: links.accessNoMfa,
        }
      : null,
  ];
  const guide = nudges.filter((item): item is GuideItem => item !== null).slice(0, 3);
  if (guide.length === 0)
    guide.push({ key: "ok", tone: "good", icon: "ok", text: t("boDash.guide.clear") });

  const sections = Object.entries(BACKOFFICE_SECTIONS).filter(([, s]) => canSee(s, capabilities));

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <PageWidth wide />
      <CommandStrip
        title={t("nav.backoffice")}
        firstName={user.fullName.split(" ")[0] ?? user.fullName}
        roles={user.roles.map((r) => t(`roles.${r}`)).join(" · ")}
        waiting={waiting}
        focus={focus}
      />
      <GuideStrip title={t("boDash.guide.title")} items={guide} />

      {flow && pipeline && sla && (
        <section
          aria-label={t("boDash.pulse")}
          className="grid grid-cols-1 gap-3 sm:gap-4 @md/main:grid-cols-2 @5xl/main:grid-cols-4"
        >
          <KpiCard
            icon="submitted"
            href={links.queueNewest}
            action={t("boDash.flow.newest")}
            label={t("boDash.kpi.in")}
            value={inWeek}
            previous={inPrev}
            series={last14.map((d) => d.submitted)}
            labels={labels14}
            seriesLabel={t("boDash.kpi.daily14")}
            detail={[
              { label: t("boDash.kpi.month"), value: String(sum(flow.map((d) => d.submitted))) },
            ]}
          />
          <KpiCard
            icon="decision"
            href={links.reports}
            action={t("boDash.actions.openReports")}
            tone="done"
            label={t("boDash.kpi.out")}
            value={outWeek}
            previous={outPrev}
            series={last14.map((d) => d.decided)}
            labels={labels14}
            seriesLabel={t("boDash.kpi.daily14")}
            detail={[
              { label: t("boDash.kpi.month"), value: String(sum(flow.map((d) => d.decided))) },
            ]}
          />
          <KpiCard
            icon="review"
            href={links.queueAll}
            action={t("boDash.actions.allOpen")}
            tone="waiting"
            label={t("boDash.kpi.open")}
            value={openNow}
            previous={openSeries[openSeries.length - 8]}
            goodWhen="down"
            series={openSeries}
            labels={labels14}
            seriesLabel={t("boDash.kpi.open14")}
            detail={[
              {
                label: t("status.application.PENDING_DECISION"),
                value: String(pipeline.counts.PENDING_DECISION),
              },
              {
                label: t("status.application.ACTION_REQUIRED"),
                value: String(pipeline.counts.ACTION_REQUIRED),
              },
            ]}
          />
          <KpiCard
            icon="sla"
            href={links.queueSla}
            action={t("boDash.actions.reviewOverdue")}
            label={t("boDash.kpi.overdue")}
            value={sla.overdue}
            goodWhen="down"
            tone={sla.overdue > 0 ? "alert" : "default"}
            seriesLabel={t("boDash.sla.detail")}
            detail={[
              { label: t("boDash.sla.dueSoon"), value: String(sla.dueSoon) },
              { label: t("boDash.sla.dueWeek"), value: String(sla.dueWeek) },
            ]}
          />
        </section>
      )}

      {flow && stages && pipeline && (
        <div className="grid items-stretch gap-4 sm:gap-5 @5xl/main:grid-cols-[1.6fr_1fr]">
          <FlowPanel days={flow} links={links} />
          <PipelinePanel stages={stages} decidedThisWeek={pipeline.decidedThisWeek} links={links} />
        </div>
      )}

      {(sla || mix || accounts || activity) && (
        <div className="grid items-stretch gap-4 sm:gap-5 @3xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {sla && <SlaPanel sla={sla} links={links} />}
          {mix && <DecisionsPanel mix={mix} links={links} />}
          {accounts && (
            <SecurityPanel
              links={links}
              total={accounts.total}
              withTwoStep={accounts.withTwoStep}
              activeSessions={accounts.activeSessions}
              newThisWeek={accounts.newThisWeek}
              byRole={accounts.byRole.map((r) => ({
                role: r.role,
                label: t(`roles.${r.role}`),
                count: r.count,
              }))}
            />
          )}
          {activity && <ActivityPanel days={activity} links={links} />}
        </div>
      )}

      {/* System health for administrators (FR-ADM-005). */}
      {capabilities.includes("roles.manage") && <HealthPanel />}

      {/* Consoles as compact chips; a Sun bubble counts what waits in each. */}
      <nav aria-label={t("backoffice.consoles")} className="flex flex-wrap gap-2">
        {sections.map(([slug, s]) => {
          const Icon = s.icon;
          const count = slug === "reports" ? 0 : (counts[slug as keyof typeof counts] ?? 0);
          return (
            <Link
              key={slug}
              href={`/backoffice/${slug}` as Route}
              className="glass group relative inline-flex h-11 items-center gap-2 rounded-full pr-4 pl-1.5 text-sm font-semibold ring-1 ring-primary/[0.08] transition-[transform,box-shadow] duration-(--dur-2) hover:-translate-y-0.5 hover:ring-primary/25 active:scale-[0.98] dark:ring-white/[0.06]"
            >
              <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-primary-soft text-link">
                <Icon className="size-4" aria-hidden />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-sun px-1 text-[0.625rem] leading-none font-bold num text-sun-foreground ring-2 ring-card">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              {t(`nav.${s.label}`)}
              {count > 0 && <span className="sr-only">: {count}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
