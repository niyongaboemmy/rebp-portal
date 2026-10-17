"use client";

import type { Route } from "next";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { ArrowRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Donut } from "./donut";
import { withValue, type DashLinks } from "./links";

const TILE =
  "glass relative flex flex-col gap-4 rounded-[1.75rem] p-5 ring-1 ring-primary/[0.08] sm:p-6 dark:ring-white/[0.06]";

/** Tile header: title, and an expand button that opens the tile's detail dialog. */
function TileHead({ title, id, expand }: { title: string; id: string; expand?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 id={id} className="text-lg">
        {title}
      </h2>
      {expand}
    </div>
  );
}

function ExpandButton({ label }: { label: string }) {
  return (
    <DialogTrigger asChild>
      <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label={label}>
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </DialogTrigger>
  );
}

/* ---- Deadlines ------------------------------------------------------------------------------ */

export function SlaPanel({
  sla,
  links,
}: {
  links: DashLinks;
  sla: {
    overdue: number;
    dueSoon: number;
    dueWeek: number;
    onTrack: number;
    urgent: { referenceNo: string; status: string; daysOver: number }[];
  };
}) {
  const t = useTranslations();
  const total = sla.overdue + sla.dueSoon + sla.dueWeek + sla.onTrack;
  const onTime = total ? Math.round(((total - sla.overdue) / total) * 100) : 100;
  const segments = [
    {
      key: "overdue",
      label: t("boDash.sla.overdue"),
      value: sla.overdue,
      color: "var(--destructive)",
      href: links.queueSla,
      action: t("boDash.actions.reviewOverdue"),
    },
    {
      key: "dueSoon",
      label: t("boDash.sla.dueSoon"),
      value: sla.dueSoon,
      color: "var(--sun)",
      href: links.queueDeadline,
      action: t("boDash.actions.planDue"),
    },
    {
      key: "dueWeek",
      label: t("boDash.sla.dueWeek"),
      value: sla.dueWeek,
      color: "color-mix(in oklch, var(--primary) 45%, var(--card))",
      href: links.queueDeadline,
      action: t("boDash.actions.planDue"),
    },
    {
      key: "onTrack",
      label: t("boDash.sla.onTrack"),
      value: sla.onTrack,
      color: "var(--primary)",
      href: links.queueAll,
      action: t("boDash.actions.allOpen"),
    },
  ];
  return (
    <Dialog>
      <section aria-labelledby="sla-title" className={TILE}>
        <TileHead
          id="sla-title"
          title={t("boDash.sla.title")}
          expand={<ExpandButton label={t("boDash.details")} />}
        />
        <Donut
          label={t("boDash.sla.title")}
          hint={links.queueAll ? t("boDash.hint.select") : undefined}
          segments={segments}
          center={
            <>
              <span
                className={cn(
                  "text-2xl font-bold num",
                  sla.overdue > 0 ? "text-destructive" : "text-link",
                )}
              >
                {onTime}%
              </span>
              <span className="text-[0.65rem] text-muted-foreground">{t("boDash.sla.onTime")}</span>
            </>
          }
        />
      </section>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("boDash.sla.title")}</DialogTitle>
          <DialogDescription>{t("boDash.sla.detail")}</DialogDescription>
        </DialogHeader>
        {sla.urgent.length === 0 ? (
          <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary-soft-foreground">
            {t("boDash.sla.none")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {sla.urgent.map((u) => (
              <li
                key={u.referenceNo}
                className="flex items-center gap-3 rounded-xl bg-foreground/[0.03] px-3 py-2 text-sm dark:bg-white/[0.04]"
              >
                <RefLink base={links.queueSearch} referenceNo={u.referenceNo} />
                <span className="flex-1 truncate text-xs text-muted-foreground">
                  {t(`status.application.${u.status}`)}
                </span>
                <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold num text-destructive">
                  +{t("boDash.days", { count: u.daysOver })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {links.queueSla && (
          <Button asChild className="group justify-self-end rounded-full">
            <Link href={links.queueSla}>
              {t("boDash.actions.reviewOverdue")}
              <ArrowRight
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A reference number that opens the file in the queue when the viewer has the queue. */
export function RefLink({ base, referenceNo }: { base?: string; referenceNo: string }) {
  const href = withValue(base, referenceNo);
  if (!href) return <span className="font-mono text-xs">{referenceNo}</span>;
  return (
    <Link href={href} className="font-mono text-xs text-link underline-offset-2 hover:underline">
      {referenceNo}
    </Link>
  );
}

/* ---- Decisions ------------------------------------------------------------------------------ */

/** Outcomes in the brand palette: approved blue, deferred (still waiting) Sun yellow, rejected red. */
const OUTCOME_COLOR: Record<string, string> = {
  APPROVED: "var(--primary)",
  APPROVED_WITH_CONDITIONS: "color-mix(in oklch, var(--primary) 50%, var(--card))",
  DEFERRED: "var(--sun)",
  REJECTED: "var(--destructive)",
};

export function DecisionsPanel({
  mix,
  links,
}: {
  mix: { outcome: string; count: number }[];
  links: DashLinks;
}) {
  const t = useTranslations();
  const total = mix.reduce((s, m) => s + m.count, 0);
  const approved = mix
    .filter((m) => m.outcome.startsWith("APPROVED"))
    .reduce((s, m) => s + m.count, 0);
  return (
    <section aria-labelledby="decisions-title" className={TILE}>
      <TileHead id="decisions-title" title={t("boDash.decisions.title")} />
      <Donut
        label={t("boDash.decisions.title")}
        segments={mix.map((m) => ({
          key: m.outcome,
          label: t.has(`status.application.${m.outcome}`)
            ? t(`status.application.${m.outcome}`)
            : m.outcome,
          value: m.count,
          color: OUTCOME_COLOR[m.outcome] ?? "var(--muted-foreground)",
          href: links.reports,
          action: t("boDash.actions.openReports"),
        }))}
        hint={links.reports ? t("boDash.hint.select") : undefined}
        center={
          <>
            <span className="text-2xl font-bold num">
              {total ? Math.round((approved / total) * 100) : 0}%
            </span>
            <span className="text-[0.65rem] text-muted-foreground">
              {t("boDash.decisions.approved")}
            </span>
          </>
        }
      />
      <span className="text-xs text-muted-foreground">
        {t("boDash.decisions.window", { count: total })}
      </span>
    </section>
  );
}

/* ---- Activity heat strip --------------------------------------------------------------------- */

export function ActivityPanel({
  days,
  links,
}: {
  days: { day: string; count: number }[];
  links: DashLinks;
}) {
  const t = useTranslations("boDash.activity");
  const format = useFormatter();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const shown = active === null ? null : days[active];
  return (
    <section aria-labelledby="activity-title" className={TILE}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="activity-title" className="text-lg">
          {t("title")}
        </h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {shown
            ? `${format.dateTime(new Date(`${shown.day}T12:00:00Z`), { day: "numeric", month: "short" })} · ${shown.count}`
            : t("total", { count: format.number(total) })}
        </span>
      </div>
      <ol className="grid grid-cols-10 gap-1.5" aria-label={t("title")}>
        {days.map((d, i) => (
          <li key={d.day}>
            <DayCell
              href={links.audit ? (`${links.audit}?from=${d.day}&to=${d.day}` as Route) : undefined}
              aria-label={`${format.dateTime(new Date(`${d.day}T12:00:00Z`), { day: "numeric", month: "long" })}: ${d.count}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="block aspect-square w-full animate-in rounded-md transition-transform fill-mode-both outline-none zoom-in-50 fade-in hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50"
              style={{
                background:
                  level(d.count) === 0
                    ? "color-mix(in oklch, var(--foreground) 6%, transparent)"
                    : `color-mix(in oklch, var(--primary) ${[0, 22, 45, 70, 100][level(d.count)]}%, var(--card))`,
                animationDelay: `${i * 15}ms`,
              }}
            />
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between text-[0.625rem] text-muted-foreground">
        <span>{t("less")}</span>
        <span className="flex gap-1" aria-hidden>
          {[0, 22, 45, 70, 100].map((p) => (
            <span
              key={p}
              className="size-2.5 rounded-sm"
              style={{
                background:
                  p === 0
                    ? "color-mix(in oklch, var(--foreground) 6%, transparent)"
                    : `color-mix(in oklch, var(--primary) ${p}%, var(--card))`,
              }}
            />
          ))}
        </span>
        <span>{t("more")}</span>
      </div>
      {links.audit && (
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[0.6875rem] text-muted-foreground">{t("hint")}</span>
          <Link
            href={links.audit}
            className="group inline-flex items-center gap-1 text-xs font-semibold text-link"
          >
            {t("open")}
            <ArrowRight
              aria-hidden
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </span>
      )}
    </section>
  );
}

/** A heat-strip day: a link to that day's audit events when the viewer has the audit trail. */
function DayCell({ href, ...props }: { href?: Route } & Omit<React.ComponentProps<"a">, "href">) {
  if (href) return <Link href={href} {...props} />;
  return <button type="button" {...(props as React.ComponentProps<"button">)} />;
}

/* ---- Security posture ------------------------------------------------------------------------ */

export function SecurityPanel({
  links,
  total,
  withTwoStep,
  activeSessions,
  newThisWeek,
  byRole,
}: {
  links: DashLinks;
  total: number;
  withTwoStep: number;
  activeSessions: number;
  newThisWeek: number;
  byRole: { role: string; label: string; count: number }[];
}) {
  const t = useTranslations("boDash.security");
  const share = total ? Math.round((withTwoStep / total) * 100) : 0;
  const max = Math.max(1, ...byRole.map((r) => r.count));
  return (
    <Dialog>
      <section aria-labelledby="security-title" className={TILE}>
        <TileHead
          id="security-title"
          title={t("title")}
          expand={<ExpandButton label={t("details")} />}
        />
        <Donut
          label={t("twoStep")}
          hint={links.accessNoMfa ? t("hint") : undefined}
          size={120}
          segments={[
            {
              key: "on",
              label: t("protected"),
              value: withTwoStep,
              color: "var(--primary)",
              href: links.accessActive,
              action: t("openPeople"),
            },
            {
              key: "off",
              label: t("unprotected"),
              value: Math.max(0, total - withTwoStep),
              color: "color-mix(in oklch, var(--primary) 22%, var(--card))",
              href: links.accessNoMfa,
              action: t("remind"),
            },
          ]}
          center={
            <>
              <span className={"text-xl font-bold num"}>{share}%</span>
              <span className="text-[0.6rem] text-muted-foreground">{t("twoStep")}</span>
            </>
          }
        />
        <div className="grid grid-cols-3 gap-2">
          <Mini label={t("accounts")} value={total} />
          <Mini label={t("sessions")} value={activeSessions} live />
          <Mini label={t("new")} value={newThisWeek} />
        </div>
      </section>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("byRole")}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {byRole.map((r) => (
            <li key={r.role} className="flex items-center gap-3 text-sm">
              {withValue(links.accessRole, r.role) ? (
                <Link
                  href={withValue(links.accessRole, r.role)!}
                  className="w-40 shrink-0 truncate text-xs text-link underline-offset-2 hover:underline"
                >
                  {r.label}
                </Link>
              ) : (
                <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">
                  {r.label}
                </span>
              )}
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </span>
              <span className="w-10 text-right font-bold num">{r.count}</span>
            </li>
          ))}
        </ul>
        {links.accessActive && (
          <Button asChild className="group justify-self-end rounded-full">
            <Link href={links.accessActive}>
              {t("open")}
              <ArrowRight
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Mini({ label, value, live }: { label: string; value: number; live?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-foreground/[0.03] px-2.5 py-2 dark:bg-white/[0.04]">
      <span className="flex items-center gap-1 text-[0.625rem] text-muted-foreground">
        {live && <span className="size-1.5 rounded-full bg-primary" aria-hidden />}
        {label}
      </span>
      <span className="text-base font-bold num">{value}</span>
    </div>
  );
}
