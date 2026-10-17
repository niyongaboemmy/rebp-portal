import {
  ArrowRight,
  Bell,
  BookUser,
  Check,
  Clock3,
  CreditCard,
  FilePlus2,
  FileStack,
  History,
  Inbox,
  Mail,
  MessageSquare,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  UserCheck,
  UserRound,
  Wallet,
  type LucideIcon,
} from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { CATEGORY_INFO, cvCompletion, renewalTiming } from "@rebp/contracts";
import { LifecycleTrack } from "@/components/applications/lifecycle-track";
import {
  ApplicationStatusBadge,
  LicenceStatusBadge,
} from "@/components/applications/status-badges";
import { ProgressRing } from "@/components/data/progress-ring";
import { TONE_SOFT_BG, TONE_TEXT } from "@/components/data/tones";
import { ValidityRing } from "@/components/data/validity-ring";
import { knownFlags } from "@/components/licence/licence-flags";
import { CountUp } from "@/components/motion/count-up";
import { LicenceCard } from "@/components/licence/licence-card";
import { SpotlightGroup } from "@/components/motion/spotlight-group";
import { TiltCard } from "@/components/motion/tilt-card";
import { LookAtPointer } from "@/components/motion/look-at-pointer";
import { ProfileBuddy, type BuddyMood } from "@/components/profile/profile-buddy";
import { Button } from "@/components/ui/button";
import { PANEL } from "@/components/ui/surface";
import { AUDIT_ACTIONS, UNKNOWN_ACTION, actionLabelKey } from "@/config/audit-actions";
import { daysUntil, formatDay } from "@/lib/format";
import { lifecycleOf } from "@/lib/lifecycle";
import { relativeLabel } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { listApplications } from "@/server/applications/applications";
import { requireUser } from "@/server/auth/guards";
import { getConfig } from "@/server/config/config";
import { db } from "@/server/db";
import {
  IN_PROGRESS_STATUSES,
  dashboardWaiting,
  walletLicences,
} from "@/server/licensing/wallet-queries";
import { verifyUrl } from "@/server/licensing/official-documents";
import { recentNotifications } from "@/server/notifications/inbox";
import { cvOf } from "@/server/profile/cv";
import { profileStatus } from "@/server/profile/profile";
import { dayOf, todayKigali } from "@/server/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("dashboard") };
}

/** The applicant's own security-relevant events (FR-AUD-005); staff-only access changes excluded. */
const FEED_ACTIONS = Object.keys(AUDIT_ACTIONS).filter(
  (action) => !action.startsWith("access.") && action !== "auth.mfa_challenged",
);

type Todo = {
  key: string;
  icon: LucideIcon;
  title: string;
  meta?: string;
  href: Route;
  /** The applicant's turn (a yellow marker), or waiting on someone else (a calm clock). */
  yours: boolean;
  urgent?: boolean;
};

/** The one thing the hero puts forward, most urgent first. */
type Focus =
  "respond" | "renew" | "renewLate" | "pay" | "inbox" | "draft" | "waiting" | "licence" | "start";

const FOCUS_MOOD: Record<Focus, BuddyMood> = {
  respond: "worried",
  renew: "badge",
  renewLate: "worried",
  pay: "pay",
  inbox: "documents",
  draft: "write",
  waiting: "waiting",
  licence: "celebrate",
  start: "wave",
};

const FOCUS_ICON: Record<Focus, LucideIcon> = {
  respond: MessageSquare,
  renew: RefreshCw,
  renewLate: RefreshCw,
  pay: CreditCard,
  inbox: Inbox,
  draft: PenLine,
  waiting: Clock3,
  licence: Wallet,
  start: FilePlus2,
};

/**
 * FR-PORTAL-001/004, UX-029: the applicant's home, built for a decision at a glance. A hero says
 * where things stand and puts the single most urgent thing forward (with the companion acting it
 * out); four numbers follow (your turn, in progress, licences, account); then the to-do list split
 * into your turn and waiting on others, the applications on their journey, the licence with its
 * countdown, account setup, the latest notifications and account activity.
 */
export default async function DashboardPage() {
  const { user } = await requireUser();
  const [t, tTime, format, locale, activity, applications, licences, waiting, thresholds, notes] =
    await Promise.all([
      getTranslations(),
      getTranslations("time"),
      getFormatter(),
      getLocale(),
      db.auditEvent.findMany({
        where: { actorId: user.id, action: { in: FEED_ACTIONS } },
        orderBy: { id: "desc" },
        take: 4,
        select: { id: true, action: true, occurredAt: true },
      }),
      listApplications(user.id),
      walletLicences(user.id),
      dashboardWaiting(user.id),
      getConfig("thresholds"),
      recentNotifications(user.id, 4),
    ]);
  const firstName = user.fullName.split(" ")[0] ?? user.fullName;
  const now = new Date();
  const today = todayKigali(now);
  const when = (d: Date) =>
    relativeLabel(d, now, tTime, (x) => format.dateTime(x, { dateStyle: "medium" }));

  // FR-PORTAL-001: applications still moving, newest activity first.
  const inProgress = applications.filter((a) => IN_PROGRESS_STATUSES.includes(a.status));
  const references = new Map(applications.map((a) => [a.id, a.referenceNo]));
  const renewing = new Set(
    inProgress.filter((a) => a.type === "RENEWAL").map((a) => a.relatedLicenceId),
  );
  const current = licences.filter((l) => l.status !== "SUPERSEDED");
  const active = current.filter((l) => l.status === "ACTIVE");
  const firstActive = active[0];
  const firstActiveDays = firstActive ? daysUntil(firstActive.expiresAt, now) : 0;

  // FR-PORTAL-004 / FR-REN-001: renewals due now (window open or late within grace).
  const renewals = current
    .map((licence) => ({
      licence,
      timing: renewalTiming(licence.status, dayOf(licence.expiresAt), today, thresholds.value),
      days: daysUntil(licence.expiresAt, now),
    }))
    .filter(
      (r) =>
        (r.timing === "open" || r.timing === "late") &&
        !r.licence.flags.includes("RENEWAL_PENDING") &&
        !renewing.has(r.licence.id),
    );
  const renewal = renewals[0];

  const infoRequests = inProgress.filter((a) => a.infoRequests.length > 0);
  const payments = inProgress.filter((a) => a.status === "PENDING_PAYMENT");
  const drafts = inProgress.filter((a) => a.status === "DRAFT");
  const category = (c: keyof typeof CATEGORY_INFO) => t(`categories.items.${c}.name`);

  // FR-PORTAL-004: everything waiting on the applicant, then on someone else — most urgent first.
  const todos: Todo[] = [
    ...infoRequests.map((a) => ({
      key: `info-${a.id}`,
      icon: MessageSquare,
      title: t("dashboard.actions.respond", { reference: a.referenceNo }),
      meta: t("dashboard.actions.dueOn", { date: formatDay(a.infoRequests[0]!.dueAt, locale) }),
      href: `/applications/${a.id}/wizard` as Route,
      yours: true,
      urgent: true,
    })),
    ...renewals.map((r) => ({
      key: `renew-${r.licence.id}`,
      icon: RefreshCw,
      title: t("dashboard.actions.renew", { number: r.licence.licenceNo }),
      meta:
        r.timing === "late"
          ? t("dashboard.actions.renewLate")
          : t("dashboard.actions.expiresIn", { count: Math.max(0, r.days) }),
      href: `/applications/new?type=RENEWAL&licence=${r.licence.id}` as Route,
      yours: true,
      urgent: r.timing === "late",
    })),
    ...payments.map((a) => ({
      key: `pay-${a.id}`,
      icon: CreditCard,
      title: t("dashboard.actions.pay", { reference: a.referenceNo }),
      href: `/applications/${a.id}/pay` as Route,
      yours: true,
    })),
    ...(waiting.inbox > 0
      ? [
          {
            key: "inbox",
            icon: Inbox,
            title: t("dashboard.actions.inbox", { count: waiting.inbox }),
            href: "/confirmations" as Route,
            yours: true,
          },
        ]
      : []),
    ...drafts.map((a) => ({
      key: `draft-${a.id}`,
      icon: PenLine,
      title: t("dashboard.actions.continueDraft", { category: category(a.category) }),
      meta: a.referenceNo,
      href: `/applications/${a.id}/wizard` as Route,
      yours: true,
    })),
    ...current.flatMap((l) =>
      knownFlags(l.flags).map((flag) => ({
        key: `flag-${l.id}-${flag}`,
        icon: TriangleAlert,
        title: t(`wallet.flags.${flag}.title`),
        meta: l.licenceNo,
        href: `/licenses/${l.id}` as Route,
        yours: flag !== "RENEWAL_PENDING",
      })),
    ),
    ...waiting.pending.map((c) => ({
      key: `wait-${c.id}`,
      icon: UserCheck,
      title: t("dashboard.actions.waitingFor", { name: c.addressee.fullName }),
      meta: references.get(c.applicationId),
      href: `/applications/${c.applicationId}` as Route,
      yours: false,
    })),
  ];
  const yourTodos = todos.filter((x) => x.yours);
  const theirTodos = todos.filter((x) => !x.yours);

  // The hero's one thing, and its link.
  const focus: { kind: Focus; href: Route; values?: Record<string, string | number> } =
    infoRequests[0]
      ? {
          kind: "respond",
          href: `/applications/${infoRequests[0].id}/wizard` as Route,
          values: { reference: infoRequests[0].referenceNo },
        }
      : renewal
        ? {
            kind: renewal.timing === "late" ? "renewLate" : "renew",
            href: `/applications/new?type=RENEWAL&licence=${renewal.licence.id}` as Route,
            values: { number: renewal.licence.licenceNo, count: Math.max(0, renewal.days) },
          }
        : payments[0]
          ? {
              kind: "pay",
              href: `/applications/${payments[0].id}/pay` as Route,
              values: { reference: payments[0].referenceNo },
            }
          : waiting.inbox > 0
            ? { kind: "inbox", href: "/confirmations" as Route, values: { count: waiting.inbox } }
            : drafts[0]
              ? {
                  kind: "draft",
                  href: `/applications/${drafts[0].id}/wizard` as Route,
                  values: { category: category(drafts[0].category) },
                }
              : inProgress[0]
                ? {
                    kind: "waiting",
                    href: `/applications/${inProgress[0].id}` as Route,
                    values: { reference: inProgress[0].referenceNo },
                  }
                : firstActive
                  ? {
                      kind: "licence",
                      href: `/licenses/${firstActive.id}` as Route,
                      values: { number: firstActive.licenceNo },
                    }
                  : { kind: "start", href: "/applications/new" as Route };
  const danger = focus.kind === "respond" || focus.kind === "renewLate";
  const mood = FOCUS_MOOD[focus.kind];
  const FocusIcon = FOCUS_ICON[focus.kind];
  const headline =
    yourTodos.length > 0
      ? t("dashboard.hero.headline.you", { count: yourTodos.length })
      : inProgress.length > 0
        ? t("dashboard.hero.headline.waiting")
        : firstActive
          ? t("dashboard.hero.headline.clear")
          : t("dashboard.hero.headline.new");

  // UX-010: the applicant profile leads the setup list, with its completion rate.
  const profile = await profileStatus(user);
  // UX-018: the CV follows it, with how far along it is.
  const cv = profile.required ? cvCompletion(await cvOf(user), todayKigali()) : null;
  const setup = [
    ...(profile.required
      ? [
          {
            key: "profile",
            done: profile.complete,
            icon: UserRound,
            href: "/settings/profile",
            percent: profile.percent,
          },
        ]
      : []),
    ...(cv
      ? [
          {
            key: "cv",
            done: cv.complete,
            icon: BookUser,
            href: "/settings/cv",
            percent: cv.percent,
          },
        ]
      : []),
    { key: "email", done: Boolean(user.emailVerifiedAt), icon: Mail, href: "/settings/security" },
    {
      key: "phone",
      done: Boolean(user.phoneVerifiedAt),
      icon: Smartphone,
      href: "/settings/security",
    },
    {
      key: "twoStep",
      done: user.mfaMethods.length > 0,
      icon: ShieldCheck,
      href: "/settings/security#two-step",
    },
  ] as Array<{
    key: "profile" | "cv" | "email" | "phone" | "twoStep";
    done: boolean;
    icon: LucideIcon;
    href: string;
    percent?: number;
  }>;
  const setupDone = setup.filter((s) => s.done).length;
  const setupComplete = setupDone === setup.length;

  // Four numbers to decide from.
  const stats = [
    {
      key: "yours",
      value: yourTodos.length,
      icon: PenLine,
      href: (yourTodos[0]?.href ?? "/applications") as Route,
      hint: yourTodos.length > 0 ? t("dashboard.stats.yoursHint") : t("dashboard.stats.yoursClear"),
      mark: yourTodos.length > 0,
    },
    {
      key: "progress",
      value: inProgress.length,
      icon: FileStack,
      href: "/applications" as Route,
      hint: t("dashboard.stats.progressHint", { count: theirTodos.length }),
    },
    {
      key: "licences",
      value: active.length,
      icon: Wallet,
      href: "/licenses" as Route,
      hint: firstActive
        ? t("dashboard.stats.nextExpiry", { count: Math.max(0, firstActiveDays) })
        : t("dashboard.noLicence"),
    },
    {
      key: "account",
      value: setupDone,
      total: setup.length,
      icon: ShieldCheck,
      href: (setup.find((s) => !s.done)?.href ?? "/settings/security") as Route,
      hint: setupComplete ? t("dashboard.setupDone") : t("dashboard.setupTitle"),
    },
  ] as const;

  return (
    <SpotlightGroup>
      {/* Where things stand (UX-029): the day, a one-line verdict, the single most urgent thing,
          and a companion acting it out. */}
      <section
        aria-labelledby="hello-title"
        data-spot
        data-tone={danger ? "danger" : undefined}
        className="hero-surface relative flex animate-rise items-center gap-4 overflow-hidden rounded-[1.75rem] p-5 sm:p-7"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[0.7rem] font-bold tracking-widest text-link uppercase">
              {format.dateTime(now, { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <h1 id="hello-title" className="text-2xl font-bold tracking-tight @3xl/main:text-3xl">
              {t("dashboard.greeting", { name: firstName })}
            </h1>
            <p className="text-sm text-muted-foreground">{headline}</p>
          </div>

          {/* The one thing: icon, what and why, and its button. */}
          <div className="flex max-w-2xl flex-col gap-3 rounded-2xl bg-card/75 p-3 ring-1 ring-foreground/[0.05] backdrop-blur-sm @xl/main:flex-row @xl/main:items-center dark:bg-surface-2/50 dark:ring-white/[0.06]">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className={cn(
                  "relative inline-flex size-11 shrink-0 items-center justify-center rounded-2xl",
                  danger ? "bg-danger-soft text-destructive" : "bg-primary-soft text-link",
                )}
              >
                <FocusIcon className="size-5" aria-hidden />
                {(danger || yourTodos.length > 0) && focus.kind !== "start" && (
                  <span
                    aria-hidden
                    className="missing-mark absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-sun ring-2 ring-card"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.65rem] font-bold tracking-widest text-muted-foreground uppercase">
                  {t("dashboard.hero.next")}
                </span>
                <span className="text-sm leading-snug font-semibold">
                  {t(`dashboard.hero.focus.${focus.kind}.title`, focus.values ?? {})}
                </span>
              </span>
            </div>
            <Button asChild className="group shrink-0 rounded-full">
              <Link href={focus.href}>
                {t(`dashboard.hero.focus.${focus.kind}.cta`)}
                <ArrowRight
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
          </div>
        </div>
        <div className="relative -my-2 -mr-2 hidden shrink-0 @lg/main:block">
          <span
            aria-hidden
            className={cn(
              "absolute top-4 right-[70%] z-10 hidden rounded-2xl rounded-br-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap @3xl/main:block",
              danger ? "bg-destructive text-white" : "bg-primary-soft text-primary-soft-foreground",
            )}
          >
            {t(`dashboard.hero.bubble.${mood}`)}
          </span>
          <LookAtPointer>
            <ProfileBuddy mood={mood} className="h-32 w-auto @3xl/main:h-40" />
          </LookAtPointer>
        </div>
      </section>

      {/* At a glance: four numbers, each a door to its page. */}
      <ul
        aria-label={t("dashboard.stats.label")}
        className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-4"
      >
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.key} className="animate-rise" style={{ animationDelay: `${60 + i * 50}ms` }}>
              <TiltCard
                foil={false}
                max={5}
                className="h-full [--tilt-radius:1.5rem] [&>.tilt-card-inner]:h-full"
              >
                <Link
                  href={s.href}
                  data-spot
                  className="glass group relative flex h-full flex-col gap-3 rounded-3xl p-4 ring-1 ring-primary/[0.08] transition-[transform,box-shadow] duration-(--dur-2) hover:-translate-y-0.5 hover:ring-primary/30 sm:p-5 dark:ring-white/[0.06] dark:hover:ring-primary/40"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t(`dashboard.stats.${s.key}`)}
                    </span>
                    <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link">
                      <Icon className="size-[1.05rem]" aria-hidden />
                      {"mark" in s && s.mark && (
                        <span
                          aria-hidden
                          className="missing-mark absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-sun ring-2 ring-card"
                        />
                      )}
                    </span>
                  </span>
                  <span className="flex h-12 items-center gap-3">
                    {"total" in s ? (
                      <ProgressRing
                        value={s.value}
                        total={s.total}
                        thickness={3.5}
                        className="size-12"
                        label={t("dashboard.setupProgress", { done: s.value, total: s.total })}
                      >
                        <span className="text-xs font-bold num">
                          {s.value}/{s.total}
                        </span>
                      </ProgressRing>
                    ) : (
                      <span className="text-3xl leading-none font-bold num tracking-tight">
                        <CountUp value={s.value} />
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.hint}</span>
                </Link>
              </TiltCard>
            </li>
          );
        })}
      </ul>

      {/* Two columns on wide screens; on narrow ones the columns dissolve so the activity log can
          go last, after the licence and setup. */}
      <div className="grid items-start gap-4 @4xl/main:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-4 @max-4xl/main:contents">
          {/* FR-PORTAL-004: to do — the applicant's turn first, then who they're waiting on. */}
          <section aria-labelledby="todo-title" className={cn("flex flex-col gap-4", PANEL)}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="todo-title" className="text-lg">
                {t("dashboard.cards.actions")}
              </h2>
              {todos.length > 0 && (
                <span className="text-xs font-semibold num text-muted-foreground">
                  {t("dashboard.todo.count", { count: todos.length })}
                </span>
              )}
            </div>
            {todos.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl bg-primary/[0.04] p-4 dark:bg-surface-2/50">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-link">
                  <Check className="size-5" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{t("dashboard.todo.clear")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("dashboard.todo.clearBody")}
                  </span>
                </span>
              </div>
            ) : (
              [
                { key: "yours", items: yourTodos },
                { key: "others", items: theirTodos },
              ]
                .filter((g) => g.items.length > 0)
                .map((group) => (
                  <div key={group.key} className="flex flex-col gap-2">
                    <span className="text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
                      {t(`dashboard.todo.${group.key as "yours"}`)}
                    </span>
                    {/* One list group: hairline dividers, each row opens its fix. */}
                    <ul className="divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl ring-1 ring-foreground/[0.07] dark:divide-white/[0.06] dark:bg-surface-2/50 dark:ring-white/[0.06]">
                      {group.items
                        .slice(0, 6)
                        .map(({ key, icon: Icon, title, meta, href, yours, urgent }) => (
                          <li key={key}>
                            <Link
                              href={href}
                              className="group flex min-h-14 items-center gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-primary/[0.035] dark:hover:bg-surface-3"
                            >
                              <span
                                className={cn(
                                  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                                  urgent
                                    ? "bg-danger-soft text-destructive"
                                    : "bg-primary-soft text-link",
                                )}
                              >
                                <Icon className="size-4" aria-hidden />
                                {yours ? (
                                  <span
                                    aria-hidden
                                    className="missing-mark absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-sun ring-2 ring-card"
                                  />
                                ) : (
                                  <span className="absolute -right-1 -bottom-1 inline-flex size-4 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-foreground/10">
                                    <Clock3 className="size-2.5" aria-hidden />
                                  </span>
                                )}
                              </span>
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="font-medium">{title}</span>
                                {meta && (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {meta}
                                  </span>
                                )}
                              </span>
                              <ArrowRight
                                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-link"
                                aria-hidden
                              />
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))
            )}
          </section>

          {/* FR-PORTAL-001: applications on their journey — or the journey to come. */}
          <section aria-labelledby="apps-title" className={cn("flex flex-col gap-4", PANEL)}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="apps-title" className="text-lg">
                {t("dashboard.cards.applications")}
              </h2>
              <Link
                href="/applications"
                className="inline-flex items-center gap-1 text-sm font-semibold text-link hover:underline"
              >
                {t("dashboard.allApplications")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            {inProgress.length === 0 ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">{t("dashboard.startShort")}</p>
                <LifecycleTrack index={0} state="active" />
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="rounded-full">
                    <Link href={"/applications/new" as Route}>
                      <FilePlus2 aria-hidden /> {t("placeholders.applicationsCta")}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/eligibility">{t("nav.eligibility")}</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {inProgress.slice(0, 3).map((app) => {
                  const life = lifecycleOf(app.status, app.lastStep);
                  return (
                    <li key={app.id}>
                      <Link
                        href={`/applications/${app.id}` as Route}
                        className="group flex flex-col gap-3 rounded-2xl p-3.5 ring-1 ring-foreground/[0.07] transition-[background-color,box-shadow] duration-(--dur-2) hover:bg-primary/[0.03] hover:ring-primary/25 dark:bg-surface-2/50 dark:ring-white/[0.06] dark:hover:bg-surface-3"
                      >
                        <span className="flex items-start gap-3">
                          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,var(--primary-soft),color-mix(in_oklch,var(--primary)_14%,var(--card)))] text-[0.65rem] font-bold text-link">
                            {CATEGORY_INFO[app.category].abbreviation}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold">
                              {category(app.category)}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {t(`applicationTypes.${app.type}.name`)} ·{" "}
                              <span className="font-mono">{app.referenceNo}</span>
                            </span>
                          </span>
                          <ApplicationStatusBadge status={app.status} className="max-sm:hidden" />
                        </span>
                        <LifecycleTrack index={life.index} state={life.state} compact />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          {/* Recent account activity from the audit trail (FR-AUD-005). */}
          <section
            aria-labelledby="activity-title"
            className={cn("flex flex-col gap-4 @max-4xl/main:order-last", PANEL)}
          >
            <h2 id="activity-title" className="inline-flex items-center gap-2 text-lg">
              <History className="size-5 text-link" aria-hidden /> {t("dashboard.activity")}
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
            ) : (
              <ol className="flex flex-col">
                {activity.map((event, index) => {
                  const meta = AUDIT_ACTIONS[event.action] ?? UNKNOWN_ACTION;
                  const Icon = meta.icon;
                  const labelKey = actionLabelKey(event.action);
                  return (
                    <li key={String(event.id)} className="relative flex gap-3 pb-3.5 last:pb-0">
                      {index < activity.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute top-9 bottom-1 left-4 w-px bg-foreground/[0.08] dark:bg-white/[0.08]"
                        />
                      )}
                      <span
                        className={cn(
                          "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
                          TONE_SOFT_BG[meta.tone],
                          TONE_TEXT[meta.tone],
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="flex min-w-0 flex-col pt-0.5">
                        <span className="text-sm font-medium">
                          {t.has(labelKey)
                            ? t(labelKey as "auditActions.auth_signin")
                            : event.action}
                        </span>
                        <time
                          dateTime={event.occurredAt.toISOString()}
                          className="text-xs text-muted-foreground"
                        >
                          {when(event.occurredAt)}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-4 @max-4xl/main:contents">
          {/* Licence wallet (UX-030): the real card, turning in the light under the pointer, with
              its countdown — or the card to come. */}
          <section
            aria-labelledby="wallet-title"
            data-spot
            className={cn("relative flex flex-col gap-4 overflow-hidden", PANEL)}
          >
            <span className="flex items-center justify-between">
              <h2 id="wallet-title" className="text-lg">
                {t("nav.licenses")}
              </h2>
              <Link
                href="/licenses"
                className="inline-flex items-center gap-1 text-sm font-semibold text-link hover:underline"
              >
                {t("dashboard.openWallet")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </span>
            {firstActive ? (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-16 left-1/2 -z-10 h-40 w-[80%] -translate-x-1/2 rounded-full bg-primary/[0.12] blur-3xl dark:bg-primary/[0.22]"
                />
                <Link
                  href={`/licenses?licence=${firstActive.id}` as Route}
                  aria-label={t("dashboard.openLicence", { number: firstActive.licenceNo })}
                  className="rounded-[1.75rem] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  <TiltCard>
                    <LicenceCard
                      still
                      holder={firstActive.displayName}
                      categoryName={category(firstActive.category)}
                      section={CATEGORY_INFO[firstActive.category].section}
                      licenceNo={firstActive.licenceNo}
                      statusLabel={t(`status.licence.${firstActive.status}`)}
                      expiryLabel={t("licence.expires")}
                      expiry={formatDay(firstActive.expiresAt, locale)}
                      verifyUrl={verifyUrl(firstActive.qrToken)}
                    />
                  </TiltCard>
                </Link>
                <span className="flex items-center gap-3">
                  <ValidityRing
                    daysLeft={firstActiveDays}
                    unit={t("wallet.daysUnit")}
                    label={t("wallet.daysLeft", { count: Math.max(0, firstActiveDays) })}
                    className="size-16 shrink-0 [&_.text-2xl]:text-lg"
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <LicenceStatusBadge status={firstActive.status} className="w-fit" />
                    <span className="text-xs text-muted-foreground">
                      {t("wallet.expiresOn", { date: formatDay(firstActive.expiresAt, locale) })}
                    </span>
                  </span>
                </span>
              </>
            ) : (
              <Link
                href="/licenses"
                className="flex aspect-[2.6] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/25 text-muted-foreground transition-colors hover:border-primary/45 hover:bg-primary/[0.03]"
              >
                <Wallet className="size-6 text-link" aria-hidden />
                <span className="text-sm font-medium">{t("dashboard.noLicence")}</span>
              </Link>
            )}
          </section>

          {/* Account setup: a ring, then each check — done ones as soft ticks. */}
          <section aria-labelledby="setup-title" className={cn("flex flex-col gap-4", PANEL)}>
            <div className="flex items-center gap-4">
              <ProgressRing
                value={setupDone}
                total={setup.length}
                thickness={3.5}
                className="size-14"
                label={t("dashboard.setupProgress", { done: setupDone, total: setup.length })}
              >
                <span className="text-sm font-bold num">
                  {setupDone}/{setup.length}
                </span>
              </ProgressRing>
              <div className="flex flex-col gap-0.5">
                <h2 id="setup-title" className="text-lg">
                  {setupComplete ? t("dashboard.setupDone") : t("dashboard.setupTitle")}
                </h2>
                <p className="text-xs text-muted-foreground">{t("dashboard.setupBody")}</p>
              </div>
            </div>
            <ul className="divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl ring-1 ring-foreground/[0.07] dark:divide-white/[0.06] dark:bg-surface-2/50 dark:ring-white/[0.06]">
              {setup.map(({ key, done, icon: Icon, href, percent }) => (
                <li key={key}>
                  <Link
                    href={href as Route}
                    className="group flex min-h-11 items-center gap-3 px-3.5 py-2 text-sm font-medium transition-colors hover:bg-primary/[0.035] dark:hover:bg-surface-3"
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        done ? "text-link" : "text-muted-foreground",
                      )}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span>{t(`dashboard.setup.${key}`)}</span>
                      {/* The profile and CV show how far along they are (UX-010/018). */}
                      {percent !== undefined && !done && (
                        <span className="flex items-center gap-2">
                          <span
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.08] dark:bg-white/[0.08]"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percent}
                            aria-label={t("profile.progress", { percent })}
                          >
                            <span
                              className="block h-full rounded-full bg-primary transition-[width] duration-(--dur-4)"
                              style={{ width: `${percent}%` }}
                            />
                          </span>
                          <span className="text-xs font-semibold num text-link">{percent}%</span>
                        </span>
                      )}
                    </span>
                    {done ? (
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary-soft text-link ring-1 ring-primary/25">
                        <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                        <span className="sr-only">{t("common.verified")}</span>
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className="missing-mark size-2.5 shrink-0 rounded-full bg-sun"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Latest notifications, unread dotted (the bell has the rest). */}
          <section aria-labelledby="notes-title" className={cn("flex flex-col gap-3", PANEL)}>
            <h2 id="notes-title" className="inline-flex items-center gap-2 text-lg">
              <Bell className="size-5 text-link" aria-hidden /> {t("dashboard.updates.title")}
            </h2>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.updates.empty")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {notes.map((n) => {
                  const key = n.messageKey as "submitted";
                  const values = (n.values ?? {}) as Record<string, string>;
                  const title = t.has(`inbox.${key}.title`)
                    ? t(`inbox.${key}.title`, values)
                    : n.code;
                  const body = (
                    <>
                      <span className="relative mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-link">
                        <Bell className="size-4" aria-hidden />
                        {!n.readAt && (
                          <span
                            aria-hidden
                            className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium">{title}</span>
                      <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                        {when(n.createdAt)}
                      </span>
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link
                          href={n.href as Route}
                          className="flex items-start gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-primary/[0.035] dark:hover:bg-surface-3"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 px-1.5 py-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </SpotlightGroup>
  );
}
