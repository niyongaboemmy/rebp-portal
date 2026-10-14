import {
  ArrowRight,
  Check,
  FilePlus2,
  History,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { JOURNEY_STAGES } from "@rebp/contracts";
import { ProgressRing } from "@/components/data/progress-ring";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("dashboard") };
}

/** Audit actions shown in the applicant's own activity feed (FR-AUD-005), with their icons. */
const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  "account.created": UserPlus,
  "account.phone_changed": Smartphone,
  "auth.signin": LogIn,
  "auth.signout": LogOut,
  "auth.password_reset": KeyRound,
  "mfa.enabled": ShieldCheck,
  "mfa.disabled": ShieldCheck,
  "mfa.recovery_codes_regenerated": KeyRound,
  "auth.sessions_revoked": LogOut,
};

/**
 * FR-PORTAL-001/004: the applicant's home. Everything is a graphic with one line of text:
 * account setup as a ring, the licence wallet, the five-stage journey and recent activity.
 * Applications and licences appear here as soon as those modules ship (WP-2.x / WP-4.x).
 */
export default async function DashboardPage() {
  const { user } = await requireUser();
  const [t, format, activity] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.auditEvent.findMany({
      where: { actorId: user.id, action: { in: Object.keys(ACTIVITY_ICONS) } },
      orderBy: { id: "desc" },
      take: 5,
      select: { id: true, action: true, occurredAt: true },
    }),
  ]);
  const firstName = user.fullName.split(" ")[0] ?? user.fullName;
  const now = new Date();

  const setup = [
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
  ] as const;
  const setupDone = setup.filter((s) => s.done).length;

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-sm font-medium text-muted-foreground">
          {format.dateTime(now, { weekday: "long", day: "numeric", month: "long" })}
        </span>
        <h1>{t("dashboard.greeting", { name: firstName })}</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Start: the journey every application follows, as five nodes. */}
        <section
          aria-labelledby="start-title"
          className="relative isolate flex flex-col gap-6 overflow-hidden rounded-3xl p-5 bg-brand sm:p-7"
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-imigongo text-white opacity-[0.07]"
          />
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="start-title" className="text-white">
                {t("dashboard.startTitle")}
              </h2>
              <p className="text-sm text-white">{t("dashboard.startShort")}</p>
            </div>
            <span className="inline-flex size-12 shrink-0 animate-pop items-center justify-center rounded-2xl bg-white/15 text-white">
              <FilePlus2 className="size-6" aria-hidden />
            </span>
          </div>
          <ol className="grid grid-cols-5 gap-1" aria-label={t("dashboard.journey")}>
            {JOURNEY_STAGES.map((stage, index) => (
              <li key={stage} className="flex flex-col items-center gap-2 text-center">
                <span className="flex w-full items-center">
                  <span className={cn("h-0.5 flex-1", index === 0 ? "opacity-0" : "bg-white/35")} />
                  <span
                    className="inline-flex size-8 shrink-0 animate-pop items-center justify-center rounded-full bg-white/15 text-xs font-bold num text-white ring-1 ring-white/40"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      "h-0.5 flex-1",
                      index === JOURNEY_STAGES.length - 1 ? "opacity-0" : "bg-white/35",
                    )}
                  />
                </span>
                <span className="text-[0.7rem] leading-tight font-semibold text-white">
                  {t(`journey.stages.${stage}`)}
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2 xs:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-white text-[oklch(0.36_0.08_160)] hover:bg-white/90"
            >
              <Link href="/applications">
                {t("placeholders.applicationsCta")} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10">
              <Link href="/eligibility">{t("nav.eligibility")}</Link>
            </Button>
          </div>
        </section>

        {/* Account setup ring: complete it once, then it gets out of the way. */}
        <section
          aria-labelledby="setup-title"
          className="flex flex-col gap-5 rounded-3xl border bg-card p-5 raised sm:p-6"
        >
          <div className="flex items-center gap-4">
            <ProgressRing
              value={setupDone}
              total={setup.length}
              tone={setupDone === setup.length ? "good" : undefined}
              className="size-16"
              label={t("dashboard.setupProgress", { done: setupDone, total: setup.length })}
            >
              <span className="text-lg font-bold num">
                {setupDone}/{setup.length}
              </span>
            </ProgressRing>
            <div className="flex flex-col gap-0.5">
              <h2 id="setup-title" className="text-lg">
                {setupDone === setup.length ? t("dashboard.setupDone") : t("dashboard.setupTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("dashboard.setupBody")}</p>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {setup.map(({ key, done, icon: Icon, href }) => (
              <li key={key}>
                <Link
                  href={href as Route}
                  className={cn(
                    "flex tap-target items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                    done ? "bg-success-soft text-success" : "bg-surface-2 hover:bg-surface-3",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1">{t(`dashboard.setup.${key}`)}</span>
                  {done ? (
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-success text-card">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      <span className="sr-only">{t("common.verified")}</span>
                    </span>
                  ) : (
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Licence wallet slot: an outline of the card that will live here. */}
        <Link
          href="/licenses"
          className="group flex flex-col gap-4 rounded-3xl border bg-card p-5 raised transition-[border-color,transform] duration-(--dur-2) hover:border-primary/40 active:scale-[0.99] sm:p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg">{t("nav.licenses")}</h2>
            <ArrowRight
              className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </div>
          <div className="flex aspect-[2.6] items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-muted-foreground">
            <Wallet className="size-6" aria-hidden />
            <span className="text-sm font-medium">{t("dashboard.noLicence")}</span>
          </div>
        </Link>

        {/* Recent account activity from the audit trail (FR-AUD-005). */}
        <section
          aria-labelledby="activity-title"
          className="flex flex-col gap-4 rounded-3xl border bg-card p-5 raised sm:p-6"
        >
          <div className="flex items-center gap-2">
            <History className="size-4 text-primary" aria-hidden />
            <h2 id="activity-title" className="text-lg">
              {t("dashboard.activity")}
            </h2>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
          ) : (
            <ol className="flex flex-col">
              {activity.map((event, index) => {
                const Icon = ACTIVITY_ICONS[event.action] ?? History;
                const key = event.action.replace(".", "_");
                return (
                  <li key={String(event.id)} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < activity.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute top-9 bottom-1 left-[1.0625rem] w-px bg-border"
                      />
                    )}
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="flex min-w-0 flex-col pt-1">
                      <span className="text-sm font-medium">
                        {t.has(`activity.${key}`)
                          ? t(`activity.${key}` as "activity.auth_signin")
                          : event.action}
                      </span>
                      <time
                        dateTime={event.occurredAt.toISOString()}
                        className="text-xs text-muted-foreground"
                      >
                        {format.relativeTime(event.occurredAt, now)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
