import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  Download,
  Eye,
  FilePlus2,
  RefreshCw,
  ShieldCheck,
} from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { CATEGORY_INFO, renewalTiming } from "@rebp/contracts";
import { LifecycleTrack } from "@/components/applications/lifecycle-track";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { ValidityRing } from "@/components/data/validity-ring";
import { LicenceCard } from "@/components/licence/licence-card";
import { LicenceFlags } from "@/components/licence/licence-flags";
import { PresentQr } from "@/components/licence/present-qr";
import { SpotlightGroup } from "@/components/motion/spotlight-group";
import { TiltCard } from "@/components/motion/tilt-card";
import { LookAtPointer } from "@/components/motion/look-at-pointer";
import { ProfileBuddy, type BuddyMood } from "@/components/profile/profile-buddy";
import { Button } from "@/components/ui/button";
import { PANEL } from "@/components/ui/surface";
import { daysUntil, formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/guards";
import { getConfig } from "@/server/config/config";
import { verifyUrl } from "@/server/licensing/official-documents";
import { walletLicences } from "@/server/licensing/wallet-queries";
import { dayOf, todayKigali } from "@/server/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("placeholders"))("licensesTitle") };
}

/**
 * Screen 6, licence wallet (FR-PORTAL-003, FR-N-002, FR-REN-001; UX-030). A hero with the
 * companion and the wallet in three numbers; the chosen licence as a physical card that tilts
 * under the pointer (glare and holographic foil) beside its validity — a ring, the term as a
 * line with today on it, status, firm, flags and renewal — and its actions: show the QR in
 * person, download the certificate, open the details. Other licences are a list to switch to.
 */
export default async function LicensesPage({ searchParams }: PageProps<"/licenses">) {
  const { user } = await requireUser();
  const [t, locale, licences, thresholds, query] = await Promise.all([
    getTranslations(),
    getLocale(),
    walletLicences(user.id),
    getConfig("thresholds"),
    searchParams,
  ]);
  const today = todayKigali();
  const now = new Date();

  const rows = licences.map((licence) => {
    const days = daysUntil(licence.expiresAt, now);
    const timing = renewalTiming(licence.status, dayOf(licence.expiresAt), today, thresholds.value);
    return {
      licence,
      days,
      timing,
      live: licence.status === "ACTIVE",
      canRenew:
        (timing === "open" || timing === "late") && !licence.flags.includes("RENEWAL_PENDING"),
    };
  });
  const active = rows.filter((r) => r.live);
  // Red only when a renewal is late (grace period); an open window is a calm nudge.
  const late = rows.some((r) => r.canRenew && r.timing === "late");
  const renewDue = rows.filter((r) => r.canRenew);
  const nextExpiry = active.reduce<number | null>(
    (min, r) => (min === null || r.days < min ? r.days : min),
    null,
  );
  const chosen =
    rows.find((r) => r.licence.id === query.licence) ??
    rows.find((r) => r.licence.status !== "SUPERSEDED") ??
    rows[0];

  const mood: BuddyMood =
    rows.length === 0
      ? "wave"
      : late
        ? "worried"
        : renewDue.length > 0
          ? "badge"
          : active.length > 0
            ? "badge"
            : "documents";
  const bubble =
    rows.length === 0
      ? "empty"
      : renewDue.length > 0
        ? "renew"
        : active.length > 0
          ? "active"
          : "ended";

  return (
    <SpotlightGroup>
      {/* The wallet at a glance, with the companion showing off (or worrying about) the licence. */}
      <section
        aria-labelledby="wallet-title"
        data-spot
        data-tone={late ? "danger" : undefined}
        className="hero-surface relative flex animate-rise items-center gap-4 overflow-hidden rounded-[1.75rem] p-5 sm:p-7"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[0.7rem] font-bold tracking-widest text-link uppercase">
              {t("wallet.hero.eyebrow")}
            </span>
            <h1 id="wallet-title" className="text-2xl font-bold tracking-tight @3xl/main:text-3xl">
              {t("placeholders.licensesTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("wallet.subtitle")}</p>
          </div>
          {/* The wallet in three numbers: one glass strip, hairline dividers — read, not pressed. */}
          {rows.length > 0 && (
            <ul className="grid w-full max-w-xl grid-cols-3 divide-x divide-primary/10 rounded-2xl bg-card/70 py-3 ring-1 ring-primary/[0.08] dark:divide-white/[0.07] dark:bg-surface-2/50 dark:ring-white/[0.06]">
              {[
                { key: "activeLabel", value: active.length, icon: BadgeCheck, mark: false },
                {
                  key: "expiryLabel",
                  value: nextExpiry === null ? "—" : Math.max(0, nextExpiry),
                  icon: Calendar,
                  mark: false,
                },
                {
                  key: "renewLabel",
                  value: renewDue.length,
                  icon: RefreshCw,
                  mark: renewDue.length > 0,
                },
              ].map(({ key, value, icon: Icon, mark }) => (
                <li key={key} className="flex min-w-0 items-center gap-2.5 px-3 sm:px-4">
                  <span className="relative hidden size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-link xs:inline-flex">
                    <Icon className="size-4" aria-hidden />
                    {mark && (
                      <span
                        aria-hidden
                        className="missing-mark absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-sun ring-2 ring-card"
                      />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xl leading-tight font-bold num">{value}</span>
                    <span className="truncate text-[0.7rem] text-muted-foreground">
                      {t(`wallet.hero.${key as "activeLabel"}`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {/* The one thing to do: renew when it's due, otherwise open the licence. */}
            {renewDue[0] ? (
              <Button asChild className="group rounded-full">
                <Link
                  href={`/applications/new?type=RENEWAL&licence=${renewDue[0].licence.id}` as Route}
                >
                  <RefreshCw aria-hidden /> {t("wallet.hero.renewCta")}
                  <ArrowRight
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </Button>
            ) : (
              chosen && (
                <Button asChild className="group rounded-full">
                  <Link href={`/licenses/${chosen.licence.id}` as Route}>
                    <Eye aria-hidden /> {t("wallet.hero.openCta")}
                  </Link>
                </Button>
              )
            )}
            {/* Verify: a soft primary button — clearly live, second to the main action. */}
            <Button
              asChild
              variant="ghost"
              className="group rounded-full bg-primary-soft text-primary-soft-foreground hover:bg-primary/15 dark:bg-primary/15 dark:text-link dark:hover:bg-primary/25"
            >
              <Link href="/check">
                <ShieldCheck aria-hidden /> {t("nav.verify")}
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
              late ? "bg-destructive text-white" : "bg-primary-soft text-primary-soft-foreground",
            )}
          >
            {t(`wallet.hero.bubble.${bubble}`)}
          </span>
          <LookAtPointer>
            <ProfileBuddy mood={mood} className="h-32 w-auto @3xl/main:h-36" />
          </LookAtPointer>
        </div>
      </section>

      {!chosen ? (
        <EmptyWallet
          labels={{
            title: t("wallet.emptyTitle"),
            body: t("placeholders.licensesBody"),
            track: t("wallet.empty.track"),
            holder: t("wallet.empty.holder"),
            category: t("wallet.empty.category"),
            cta: t("placeholders.applicationsCta"),
            eligibility: t("nav.eligibility"),
          }}
        />
      ) : (
        <WalletStage
          row={chosen}
          locale={locale}
          graceDays={thresholds.value.graceDays}
          t={t}
          now={now}
        />
      )}

      {/* Every licence, to switch the one on stage (the current one is marked). */}
      {rows.length > 1 && (
        <section aria-labelledby="all-title" className={cn("flex flex-col gap-3", PANEL)}>
          <h2 id="all-title" className="text-lg">
            {t("wallet.allTitle", { count: rows.length })}
          </h2>
          <ul className="divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl ring-1 ring-foreground/[0.07] dark:divide-white/[0.06] dark:bg-surface-2/50 dark:ring-white/[0.06]">
            {rows.map(({ licence, days, live, canRenew }) => {
              const current = licence.id === chosen?.licence.id;
              return (
                <li key={licence.id}>
                  <Link
                    href={`/licenses?licence=${licence.id}` as Route}
                    scroll={false}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "group flex min-h-16 items-center gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-primary/[0.035] dark:hover:bg-surface-3",
                      current && "bg-primary/[0.05] dark:bg-surface-3",
                    )}
                  >
                    {/* A miniature of the card. */}
                    <span
                      aria-hidden
                      className={cn(
                        "relative isolate inline-flex h-9 w-14 shrink-0 items-end overflow-hidden rounded-lg p-1 text-[0.55rem] font-bold text-white",
                        live ? "bg-brand" : "bg-muted-foreground/60",
                      )}
                    >
                      <span className="absolute inset-0 -z-10 bg-imigongo text-white opacity-[0.12]" />
                      {CATEGORY_INFO[licence.category].abbreviation}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">
                        {t(`categories.items.${licence.category}.name`)}
                      </span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {licence.licenceNo}
                      </span>
                    </span>
                    {canRenew && (
                      <span
                        aria-hidden
                        className="missing-mark size-2.5 shrink-0 rounded-full bg-sun"
                      />
                    )}
                    <span className="hidden text-xs num text-muted-foreground @xl/main:inline">
                      {live
                        ? t("wallet.daysLeft", { count: Math.max(0, days) })
                        : formatDay(licence.expiresAt, locale)}
                    </span>
                    <LicenceStatusBadge status={licence.status} className="max-sm:hidden" />
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </SpotlightGroup>
  );
}

type Row = {
  licence: Awaited<ReturnType<typeof walletLicences>>[number];
  days: number;
  timing: ReturnType<typeof renewalTiming>;
  live: boolean;
  canRenew: boolean;
};

/** The chosen licence on stage: the card, then everything about it and what to do with it. */
async function WalletStage({
  row,
  locale,
  graceDays,
  t,
  now,
}: {
  row: Row;
  locale: string;
  graceDays: number;
  t: Awaited<ReturnType<typeof getTranslations>>;
  now: Date;
}) {
  const { licence, days, timing, live, canRenew } = row;
  const categoryName = t(`categories.items.${licence.category}.name`);
  const url = verifyUrl(licence.qrToken);
  const firm = licence.firm ?? licence.affiliatedFirm;
  const qr = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0c0f13", light: "#00000000" },
  });
  // The term as a line: how much of it has passed, with today marked.
  const span = licence.expiresAt.getTime() - licence.issuedAt.getTime();
  const elapsed = span > 0 ? (now.getTime() - licence.issuedAt.getTime()) / span : 1;
  const passed = Math.round(Math.min(1, Math.max(0, elapsed)) * 100);

  return (
    <div className="grid items-start gap-4 @4xl/main:grid-cols-[1.15fr_1fr]">
      {/* The stage: the card in the light, turning under the pointer. */}
      <section
        aria-labelledby="stage-title"
        data-spot
        className={cn("relative flex flex-col items-center gap-5 overflow-hidden", PANEL)}
      >
        <h2 id="stage-title" className="sr-only">
          {categoryName}
        </h2>
        {/* A soft pool of light behind the card. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-6 left-1/2 -z-10 h-56 w-[80%] -translate-x-1/2 rounded-full bg-primary/[0.12] blur-3xl dark:bg-primary/[0.22]"
        />
        <TiltCard className="w-full max-w-md animate-rise pt-2">
          <LicenceCard
            still
            holder={licence.displayName}
            categoryName={categoryName}
            section={CATEGORY_INFO[licence.category].section}
            licenceNo={licence.licenceNo}
            statusLabel={t(`status.licence.${licence.status}`)}
            expiryLabel={t("licence.expires")}
            expiry={formatDay(licence.expiresAt, locale)}
            verifyUrl={url}
          />
        </TiltCard>
        <p className="text-xs text-muted-foreground [@media(hover:none)]:hidden">
          {t("wallet.tiltHint")}
        </p>
        <div className="flex w-full flex-col gap-2 xs:flex-row xs:flex-wrap xs:justify-center">
          <PresentQr
            qr={qr}
            url={url}
            licenceNo={licence.licenceNo}
            holder={licence.displayName}
            category={categoryName}
            live={live}
          />
          <Button asChild variant="outline" className="rounded-full">
            <a href={`/api/files/certificate/${licence.id}?download=1`} download>
              <Download aria-hidden /> {t("wallet.downloadCertificate")}
            </a>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/licenses/${licence.id}` as Route}>
              <Eye aria-hidden /> {t("wallet.viewDetails")}
            </Link>
          </Button>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        {/* Validity: the ring, the term as a line with today on it, status and firm. */}
        <section aria-labelledby="validity-title" className={cn("flex flex-col gap-5", PANEL)}>
          <div className="flex items-center gap-4">
            {live ? (
              <ValidityRing
                daysLeft={days}
                unit={t("wallet.daysUnit")}
                label={t("wallet.daysLeft", { count: Math.max(0, days) })}
                className="size-24 shrink-0"
              />
            ) : null}
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 id="validity-title" className="text-lg">
                {t("wallet.validityTitle")}
              </h2>
              <LicenceStatusBadge status={licence.status} />
              <p className="text-sm text-muted-foreground">
                {live
                  ? t("wallet.expiresOn", { date: formatDay(licence.expiresAt, locale) })
                  : t("wallet.expiredOn", { date: formatDay(licence.expiresAt, locale) })}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="relative h-2 rounded-full bg-foreground/[0.07] dark:bg-white/[0.08]">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  live ? "bg-primary" : "bg-muted-foreground",
                )}
                style={{ width: `${passed}%` }}
              />
              {live && (
                <span
                  aria-hidden
                  className="lifecycle-pulse absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
                  style={{ left: `${passed}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {t("wallet.issuedOn")} · {formatDay(licence.issuedAt, locale)}
              </span>
              <span>
                {t("licence.expires")} · {formatDay(licence.expiresAt, locale)}
              </span>
            </div>
          </div>
          {firm && (
            <p className="inline-flex items-center gap-2 text-sm">
              <Building2 className="size-4 text-link" aria-hidden />
              {firm.tradingName ?? firm.legalName}
            </p>
          )}
          <LicenceFlags flags={licence.flags} />
        </section>

        {/* Renewal, when its window is open (BR-040). */}
        {canRenew && (
          <section
            aria-labelledby="renew-title"
            className={cn("flex flex-col gap-3", PANEL, "ring-sun/40 dark:ring-sun/30")}
          >
            <div className="flex items-center gap-3">
              <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-link">
                <RefreshCw className="size-5" aria-hidden />
                <span
                  aria-hidden
                  className="missing-mark absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-sun ring-2 ring-card"
                />
              </span>
              <h2 id="renew-title" className="text-base">
                {timing === "late"
                  ? t("wallet.renewLate", { days: graceDays + days })
                  : t("wallet.renewOpen", { count: Math.max(0, days) })}
              </h2>
            </div>
            <Button asChild className="w-fit rounded-full">
              <Link href={`/applications/new?type=RENEWAL&licence=${licence.id}` as Route}>
                <RefreshCw aria-hidden /> {t("wallet.renew")}
              </Link>
            </Button>
          </section>
        )}

        {/* Where anyone can check it. */}
        <Link
          href={`/check/${encodeURIComponent(licence.licenceNo)}` as Route}
          className={cn(
            PANEL,
            "group flex items-center gap-3 transition-[box-shadow] hover:ring-primary/30 dark:hover:ring-primary/40",
          )}
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-link">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">{t("wallet.publicEntry")}</span>
            <span className="text-xs text-muted-foreground">{t("wallet.publicHint")}</span>
          </span>
          <ArrowRight
            aria-hidden
            className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  );
}

/** No licence yet: the card to come, turning in the light, and the journey that leads to it. */
function EmptyWallet({
  labels,
}: {
  labels: Record<
    "title" | "body" | "track" | "holder" | "category" | "cta" | "eligibility",
    string
  >;
}) {
  return (
    <section
      aria-labelledby="empty-title"
      data-spot
      className={cn("relative flex flex-col items-center gap-6 overflow-hidden text-center", PANEL)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-8 left-1/2 -z-10 h-48 w-[70%] -translate-x-1/2 rounded-full bg-primary/[0.1] blur-3xl dark:bg-primary/[0.2]"
      />
      {/* A ghost of the licence: the brand card faded, its lines still to be written. */}
      <TiltCard className="w-full max-w-sm animate-rise pt-2">
        <div
          aria-hidden
          className="relative isolate flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_75%,white),var(--primary))] p-5 text-left text-white opacity-90 dark:bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_80%,black),color-mix(in_oklch,var(--primary)_55%,black))]"
        >
          <span className="absolute inset-0 -z-10 bg-imigongo text-white opacity-[0.1]" />
          <span className="flex items-start justify-between gap-3">
            <span className="flex flex-col gap-1">
              <span className="h-2 w-10 rounded-full bg-white/40" />
              <span className="text-sm font-bold opacity-90">{labels.category}</span>
            </span>
            <span className="h-6 w-16 rounded-full bg-white/30" />
          </span>
          <span className="flex items-end justify-between gap-3">
            <span className="flex flex-col gap-2">
              <span className="text-lg font-bold opacity-90">{labels.holder}</span>
              <span className="h-2.5 w-24 rounded-full bg-white/35" />
            </span>
            <span className="inline-flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-white/50 text-2xl font-bold text-white/70">
              ?
            </span>
          </span>
        </div>
      </TiltCard>
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 id="empty-title" className="text-xl">
          {labels.title}
        </h2>
        <p className="text-sm text-muted-foreground">{labels.body}</p>
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-2 text-left">
        <span className="text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
          {labels.track}
        </span>
        <LifecycleTrack index={0} state="active" />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild className="rounded-full">
          <Link href={"/applications/new" as Route}>
            <FilePlus2 aria-hidden /> {labels.cta}
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/eligibility">{labels.eligibility}</Link>
        </Button>
      </div>
    </section>
  );
}
