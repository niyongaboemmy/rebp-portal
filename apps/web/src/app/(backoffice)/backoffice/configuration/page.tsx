import { Flag, History, Money, Settings2, SlidersHorizontal } from "@/components/icons";
import type { Metadata, Route } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import {
  CONFIG_KEYS,
  mayProposeConfig,
  type ConfigKey,
  type FeatureFlags,
  type FeeSchedule,
  type RuleThresholds,
  type StatusTone,
} from "@rebp/contracts";
import {
  FeesProposalForm,
  FlagsProposalForm,
  ThresholdsProposalForm,
} from "@/components/admin/config-forms";
import { HealthPanel } from "@/components/admin/health-panel";
import { PendingConfigCard, type ConfigDiffRow } from "@/components/admin/pending-config-card";
import { RunJobsCard } from "@/components/admin/run-jobs-card";
import {
  ATTENTION_CHIP,
  ATTENTION_DOT,
  ICON_TILE,
  LIST_GROUP,
  LIST_ROW,
} from "@/components/admin/surfaces";
import { StepUpProvider } from "@/components/security/step-up";
import { Alert } from "@/components/ui/alert";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageWidth } from "@/components/layout/page-width";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { PANEL } from "@/components/ui/surface";
import { formatDay, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  configVersions,
  requireAnyCapability,
  type ConfigVersionRow,
} from "@/server/backoffice/admin-queries";
import { getConfig } from "@/server/config/config";
import { isDevMode } from "@/server/env";
import { todayKigali } from "@/server/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("configuration"))("title") };
}

const TAB_ICONS = { fees: Money, thresholds: SlidersHorizontal, flags: Flag } as const;

type Primitive = string | number | boolean | null;

/** Flattens a config value to dotted paths so two versions can be compared field by field. */
function flatten(value: unknown, prefix = ""): Map<string, Primitive> {
  const out = new Map<string, Primitive>();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      for (const [path, leaf] of flatten(v, prefix ? `${prefix}.${k}` : k)) out.set(path, leaf);
    }
  } else out.set(prefix, (value ?? null) as Primitive);
  return out;
}

/**
 * Configuration console (WP-4.3, FR-ADM-002…004): fees, eligibility thresholds and feature flags.
 * Shows the version in force, its history, a proposal form for makers (config.edit) and the pending
 * proposal with a diff for checkers (config.approve). Maker and checker are always different people.
 */
export default async function ConfigurationPage({
  searchParams,
}: PageProps<"/backoffice/configuration">) {
  const { user, capabilities } = await requireAnyCapability(["config.edit", "config.approve"]);
  const params = await searchParams;
  const tab: ConfigKey = CONFIG_KEYS.includes(params.tab as ConfigKey)
    ? (params.tab as ConfigKey)
    : "fees";
  const canEdit = capabilities.includes("config.edit");
  // FR-ADM-003: makers are scoped per key (finance: fees; administrators: everything).
  const canPropose = mayProposeConfig(tab, capabilities);
  // FR-ADM-005: the health panel is for system administrators.
  const canSeeHealth = capabilities.includes("roles.manage");
  const canApprove = capabilities.includes("config.approve");

  const [t, locale, current, versions] = await Promise.all([
    getTranslations(),
    getLocale(),
    getConfig(tab),
    configVersions(tab),
  ]);
  const pending = versions.find((v) => v.status === "PENDING") ?? null;
  const today = todayKigali();
  const now = new Date();
  const on = (b: boolean) => (b ? t("configuration.on") : t("configuration.off"));

  const fieldLabel = (path: string): string => {
    const parts = path.split(".");
    if (tab === "fees") {
      if (parts[0] === "fees" && parts[1] && parts[2])
        return `${t(`categories.items.${parts[1] as "REA"}.name`)} · ${t(
          `configuration.fees.${parts[2] as "registration"}`,
        )}`;
      if (path === "latePenaltyPercent") return t("configuration.fees.latePenalty");
      if (path === "reference") return t("configuration.fees.reference");
      if (path === "sample") return t("configuration.fees.sample");
      return path;
    }
    const key = `configuration.${tab}.fields.${path}.label`;
    return t.has(key) ? t(key as "configuration.flags.fields.autoAssign.label") : path;
  };
  const formatValue = (path: string, value: Primitive): string => {
    if (value === null) return "—";
    if (typeof value === "boolean") return on(value);
    if (typeof value === "number") {
      if (tab === "fees" && path.startsWith("fees.")) return formatMoney(value, "RWF", locale);
      if (path === "latePenaltyPercent") return `${value}%`;
      return String(value);
    }
    return value;
  };

  let diff: ConfigDiffRow[] = [];
  if (pending) {
    const before = flatten(current.value);
    const after = flatten(pending.value);
    diff = [...new Set([...before.keys(), ...after.keys()])]
      .filter((path) => before.get(path) !== after.get(path))
      .map((path) => ({
        key: path,
        label: fieldLabel(path),
        before: formatValue(path, before.get(path) ?? null),
        after: formatValue(path, after.get(path) ?? null),
      }));
  }

  const versionState = (v: ConfigVersionRow): { tone: StatusTone; label: string } => {
    if (v.status === "PENDING")
      return { tone: "warning", label: t("configuration.states.pending") };
    if (v.status === "REJECTED")
      return { tone: "critical", label: t("configuration.states.rejected") };
    if (v.version === current.version)
      return { tone: "good", label: t("configuration.states.inForce") };
    if (v.status === "ACTIVE" && v.effectiveFrom > now)
      return { tone: "info", label: t("configuration.states.scheduled") };
    return { tone: "neutral", label: t("configuration.states.superseded") };
  };

  const formKey = `${current.version}-${pending?.id ?? ""}`;
  const formProps = { today, disabled: !canPropose || Boolean(pending) };

  return (
    <StepUpProvider hasPassword={Boolean(user.passwordHash)}>
      <PageWidth wide />
      <PageHeader
        eyebrow={t("configuration.header.eyebrow")}
        title={t("configuration.title")}
        description={t("configuration.subtitle")}
        stats={[
          {
            value:
              current.version === 0
                ? t("configuration.header.defaults")
                : t("configuration.history.version", { version: current.version }),
            label: t("configuration.header.inForce"),
          },
          {
            value: pending ? 1 : 0,
            label: t("configuration.header.pending"),
            tone: pending ? "now" : "muted",
          },
          {
            value: versions.length,
            label: t("configuration.header.versions"),
            tone: "muted",
          },
        ]}
        mood={pending ? "lock" : "shield"}
        bubble={
          pending
            ? canApprove && pending.makerId !== user.id
              ? t("configuration.header.bubbleDecide")
              : t("configuration.header.bubbleWaiting")
            : t("configuration.header.bubbleClear")
        }
      />
      <LinkTabs
        label={t("configuration.title")}
        tabs={CONFIG_KEYS.map((key) => {
          const Icon = TAB_ICONS[key];
          return {
            href: (key === "fees"
              ? "/backoffice/configuration"
              : `/backoffice/configuration?tab=${key}`) as Route,
            label: t(`configuration.tabs.${key}`),
            icon: <Icon />,
            active: tab === key,
          };
        })}
      />

      {pending && (
        <PendingConfigCard
          key={pending.id}
          id={pending.id}
          version={pending.version}
          effectiveLabel={t("configuration.pending.effective", {
            date: formatDay(pending.effectiveFrom, locale),
          })}
          makerLine={t("configuration.pending.proposedBy", { name: pending.makerName ?? "—" })}
          reason={pending.reason}
          diff={diff}
          canApprove={canApprove}
          isOwn={pending.makerId === user.id}
        />
      )}

      <section aria-labelledby="in-force-title" className={cn("flex flex-col gap-5", PANEL)}>
        <div className="flex flex-wrap items-start gap-3">
          <span className={ICON_TILE} aria-hidden>
            <Settings2 />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 id="in-force-title" className="text-lg">
              {t(`configuration.inForce.${tab}`)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {current.version === 0
                ? t("configuration.inForce.default")
                : t("configuration.inForce.version", {
                    version: current.version,
                    date: formatDay(current.effectiveFrom!, locale),
                  })}
            </p>
          </div>
          <StatusBadge tone="good" label={t("configuration.states.inForce")} />
        </div>

        {canPropose && !pending && (
          <Alert variant="info">{t(`configuration.makerHint.${tab}`)}</Alert>
        )}
        {canPropose && pending && <Alert variant="warning">{t("configuration.pendingLock")}</Alert>}
        {!canPropose && (
          <Alert variant="info">
            {canEdit ? t("configuration.outOfScope") : t("configuration.readOnly")}
          </Alert>
        )}

        {tab === "fees" && (
          <FeesProposalForm key={formKey} current={current.value as FeeSchedule} {...formProps} />
        )}
        {tab === "thresholds" && (
          <ThresholdsProposalForm
            key={formKey}
            current={current.value as RuleThresholds}
            {...formProps}
          />
        )}
        {tab === "flags" && (
          <FlagsProposalForm key={formKey} current={current.value as FeatureFlags} {...formProps} />
        )}
      </section>

      <section aria-labelledby="history-title" className={cn("flex flex-col gap-4", PANEL)}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="history-title" className="inline-flex items-center gap-2 text-lg">
            <History className="size-5 text-link" aria-hidden />
            {t("configuration.history.title")}
          </h2>
          <span className="text-xs font-medium num text-muted-foreground">
            {t("configuration.header.versionsCount", { count: versions.length })}
          </span>
        </div>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("configuration.history.empty")}</p>
        ) : (
          <ol className={LIST_GROUP}>
            {versions.map((v) => {
              const state = versionState(v);
              return (
                <li key={v.id} className={cn("flex gap-3", LIST_ROW, "py-3")}>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 inline-flex h-7 min-w-9 shrink-0 items-center justify-center rounded-lg px-1.5 text-xs font-bold num",
                      state.tone === "good"
                        ? "bg-primary text-primary-foreground"
                        : "bg-foreground/[0.05] text-muted-foreground dark:bg-white/[0.06]",
                    )}
                  >
                    v{v.version}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold num">
                        {t("configuration.history.version", { version: v.version })}
                      </span>
                      {v.status === "PENDING" ? (
                        <span className={ATTENTION_CHIP}>
                          <span aria-hidden className={ATTENTION_DOT} />
                          {state.label}
                        </span>
                      ) : (
                        <StatusBadge tone={state.tone} label={state.label} />
                      )}
                      <span className="ml-auto text-xs num text-muted-foreground">
                        {t("configuration.history.effective", {
                          date: formatDay(v.effectiveFrom, locale),
                        })}
                      </span>
                    </div>
                    <p className="text-sm break-words text-foreground/80">{v.reason}</p>
                    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{t("configuration.history.maker", { name: v.makerName ?? "—" })}</span>
                      {v.checkerName && (
                        <span>{t("configuration.history.checker", { name: v.checkerName })}</span>
                      )}
                      {v.note && <span>{t("configuration.history.note", { note: v.note })}</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {canSeeHealth && <HealthPanel />}

      {isDevMode() && canEdit && <RunJobsCard />}
    </StepUpProvider>
  );
}
