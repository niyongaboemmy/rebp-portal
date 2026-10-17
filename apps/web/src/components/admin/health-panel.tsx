import {
  Activity,
  BadgeCheck,
  CircleCheck,
  Inbox,
  Link2,
  MailWarning,
  RefreshCw,
  Timer,
} from "@/components/icons";
import type { LucideIcon } from "@/components/icons";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ATTENTION_CHIP,
  ATTENTION_DOT,
  LIST_GROUP,
  LIST_ROW,
  OK_CHIP,
} from "@/components/admin/surfaces";
import { Panel } from "@/components/ui/panel";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { systemHealth } from "@/server/config/health";

/** Latency above this (ms) is worth a look on a single-node pilot. */
const SLOW_DB_MS = 250;

interface Row {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  ok: boolean;
}

/**
 * System health (FR-ADM-005, Should) for administrators: database round-trip, scheduler, issuance
 * retries, notification failures, audit chain and queue depth, each with a soft tick when fine or
 * the Sun dot when it needs someone. A Server Component that loads its own data: the page decides
 * who sees it (render it for holders of roles.manage).
 */
export async function HealthPanel({ className }: { className?: string }) {
  const [t, locale, health] = await Promise.all([
    getTranslations("health"),
    getLocale(),
    systemHealth(),
  ]);
  const rows: Row[] = [
    {
      key: "database",
      icon: Activity,
      label: t("database"),
      value: health.database.ok
        ? t("latency", { ms: health.database.latencyMs ?? 0 })
        : t("unreachable"),
      ok: health.database.ok && (health.database.latencyMs ?? 0) <= SLOW_DB_MS,
    },
    {
      key: "jobs",
      icon: Timer,
      label: t("jobs"),
      value: health.jobs.lastRunAt
        ? t("lastRun", { when: formatDateTime(health.jobs.lastRunAt, locale) })
        : t("neverRun"),
      ok: !health.jobs.stale,
    },
    {
      key: "issuance",
      icon: RefreshCw,
      label: t("issuance"),
      value: t("issuancePending", { count: health.issuance.pending }),
      ok: health.issuance.pending === 0,
    },
    {
      key: "notifications",
      icon: MailWarning,
      label: t("notifications"),
      value: t("notificationsFailed", {
        failed: health.notifications.failed,
        total: health.notifications.total,
        days: health.notifications.windowDays,
      }),
      ok: health.notifications.failed === 0,
    },
    {
      key: "chain",
      icon: Link2,
      label: t("chain"),
      value: !health.chain
        ? t("unknown")
        : health.chain.ok
          ? t("chainOk", { count: health.chain.checked })
          : t("chainBroken", { id: String(health.chain.brokenAtId) }),
      ok: Boolean(health.chain?.ok),
    },
    {
      key: "queue",
      icon: Inbox,
      label: t("queue"),
      value: t("queueDepth", { open: health.queue.open, breached: health.queue.breached }),
      ok: health.queue.breached === 0,
    },
  ];
  const attention = rows.filter((r) => !r.ok).length;

  return (
    <Panel
      id="health-title"
      title={t("title")}
      icon={BadgeCheck}
      description={t("description")}
      meta={t("checkedAt", { when: formatDateTime(health.checkedAt, locale) })}
      tone={!health.database.ok || health.chain?.ok === false ? "danger" : undefined}
      className={className}
    >
      <ul className={LIST_GROUP} data-testid="system-health">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li
              key={row.key}
              data-health={row.key}
              data-ok={row.ok ? "true" : "false"}
              className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", LIST_ROW)}
            >
              <Icon className="size-4 shrink-0 text-link" aria-hidden />
              <span className="min-w-0 flex-1 text-sm font-semibold">{row.label}</span>
              <span className="text-sm num text-muted-foreground">{row.value}</span>
              {row.ok ? (
                <span className={OK_CHIP}>
                  <CircleCheck aria-hidden /> {t("ok")}
                </span>
              ) : (
                <span className={ATTENTION_CHIP}>
                  <span aria-hidden className={ATTENTION_DOT} /> {t("attention")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {attention === 0 ? t("allClear") : t("needsAttention", { count: attention })}
      </p>
    </Panel>
  );
}
