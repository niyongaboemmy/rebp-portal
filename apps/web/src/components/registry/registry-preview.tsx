"use client";

import {
  BookUser,
  Building2,
  Calendar,
  Check,
  Copy,
  MapPin,
  Share2,
  ShieldCheck,
  ArrowRight,
} from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CATEGORY_INFO } from "@rebp/contracts";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/format";
import { parseCondition } from "@/lib/licence-display";
import { initials, termProgress, type PublicEntry } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { TERM_BAR, TIER_HERO, TIER_TILE } from "./tones";

interface PreviewApi {
  /** Open the preview with an entry, or with a licence number (fetched). */
  open: (entry: PublicEntry | string) => void;
}

const PreviewContext = createContext<PreviewApi | null>(null);

/**
 * Opens the registry preview from anywhere inside a <RegistryPreviewProvider>; outside one it
 * falls back to the verification page.
 */
export function useRegistryPreview(): PreviewApi {
  const context = useContext(PreviewContext);
  const router = useRouter();
  return (
    context ?? {
      open: (entry) => {
        const no = typeof entry === "string" ? entry : entry.licenceNo;
        router.push(`/check/${encodeURIComponent(no)}` as Route);
      },
    }
  );
}

/**
 * Hosts the large registry preview dialog for a page: cards, the map's district panel and search
 * suggestions all open the same preview. `onLocate` (map pages) adds "Show on map".
 */
export function RegistryPreviewProvider({
  children,
  onLocate,
}: {
  children: React.ReactNode;
  onLocate?: (entry: PublicEntry) => void;
}) {
  const [entry, setEntry] = useState<PublicEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [openState, setOpenState] = useState(false);

  const open = useCallback((value: PublicEntry | string) => {
    setOpenState(true);
    if (typeof value !== "string") return setEntry(value);
    setEntry(null);
    setLoading(true);
    void fetch(`/api/register/entry?no=${encodeURIComponent(value)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PublicEntry | null) => setEntry(data))
      .finally(() => setLoading(false));
  }, []);
  const api = useMemo(() => ({ open }), [open]);

  return (
    <PreviewContext.Provider value={api}>
      {children}
      <Dialog open={openState} onOpenChange={setOpenState}>
        <DialogContent
          className={cn(
            "gap-0 overflow-hidden border-0 p-0 sm:max-w-xl sm:p-0",
            // The close button sits on the coloured hero once the entry is shown.
            entry &&
              "[&>button:last-child]:text-white/85 [&>button:last-child]:hover:bg-white/15 [&>button:last-child]:hover:text-white",
          )}
        >
          {entry ? (
            <RegistryPreview
              entry={entry}
              onLocate={
                onLocate
                  ? () => {
                      setOpenState(false);
                      onLocate(entry);
                    }
                  : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-4 p-6" aria-busy={loading}>
              <DialogTitle className="sr-only">…</DialogTitle>
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-40 rounded-2xl" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PreviewContext.Provider>
  );
}

/**
 * The large registry preview: a tier-coloured hero (avatar, name, category, status), the
 * licence term as a progress bar with dates and time left, every public field, conditions, and
 * actions (verify, copy number, share, show on map).
 */
export function RegistryPreview({
  entry,
  onLocate,
}: {
  entry: PublicEntry;
  onLocate?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [now] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const tier = CATEGORY_INFO[entry.category].tier;
  const { progress, monthsLeft } = termProgress(entry.issuedAt, entry.expiresAt, now);
  const verifyPath = `/check/${encodeURIComponent(entry.licenceNo)}`;
  const conditions = entry.conditions
    .map(parseCondition)
    .filter((c) => !(entry.category === "RERA" && c.code === "REFERRAL_ONLY"));

  const copy = async () => {
    await navigator.clipboard?.writeText(entry.licenceNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const share = async () => {
    const url = new URL(verifyPath, window.location.origin).toString();
    if (navigator.share) await navigator.share({ title: entry.displayName, url }).catch(() => {});
    else await navigator.clipboard?.writeText(url);
  };

  const rows = [
    { label: t("registerResults.fields.registrationNo"), value: entry.registrationNo, mono: true },
    entry.firm && { label: t("registerResults.fields.firm"), value: entry.firm },
    entry.principalName && {
      label: t("registerResults.fields.principal"),
      value: entry.principalName,
    },
    {
      label: t("registerResults.fields.scope"),
      value: entry.scope.join(", ") || t("licence.nationwide"),
    },
    entry.districtName && {
      label: t("registerResults.fields.district"),
      value: entry.districtName,
    },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <div
        className={cn(
          "relative isolate overflow-hidden px-6 pt-7 pb-6 text-white",
          TIER_HERO[tier],
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-imigongo opacity-[0.1] dark:opacity-[0.06]"
        />
        <div
          aria-hidden
          className="absolute -right-16 -bottom-24 -z-10 size-64 rounded-full bg-white/15 blur-3xl dark:hidden"
        />
        <div
          aria-hidden
          className={cn(
            "absolute -top-24 -right-20 -z-10 hidden size-72 rounded-full opacity-35 blur-3xl dark:block",
            TIER_TILE[tier],
          )}
        />
        <div className="flex items-center gap-4 pr-8">
          <span className="inline-flex size-16 shrink-0 animate-pop items-center justify-center rounded-[1.4rem] bg-white/20 text-xl font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] backdrop-blur dark:bg-white/10">
            {initials(entry.displayName)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="truncate text-2xl leading-tight font-bold text-white">
              {entry.displayName}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-sm text-white/85">
              {entry.kind === "FIRM" ? (
                <Building2 className="size-4" aria-hidden />
              ) : (
                <BookUser className="size-4" aria-hidden />
              )}
              <span className="font-mono font-bold">{CATEGORY_INFO[entry.category].section}</span>·
              <span className="truncate">{t(`categories.items.${entry.category}.name`)}</span>
            </DialogDescription>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <LicenceStatusBadge
            status={entry.status}
            size="lg"
            className="bg-white/95 dark:bg-black/35 dark:backdrop-blur"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-8 items-center gap-2 rounded-full bg-white/15 px-3 font-mono text-sm font-semibold backdrop-blur transition-colors hover:bg-white/25 dark:bg-white/10"
            aria-label={t("registry.copyNumber")}
          >
            {entry.licenceNo}
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5 opacity-80" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {/* Term */}
        <div className="flex flex-col gap-2.5 rounded-2xl bg-surface-2 p-4 dark:bg-white/[0.04]">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 font-semibold">
              <Calendar className="size-4 text-link" aria-hidden />
              {t("registerResults.fields.validity")}
            </span>
            {entry.status === "ACTIVE" && (
              <span className="text-xs font-semibold num text-muted-foreground">
                {monthsLeft >= 12
                  ? t("registerResults.yearsLeft", { count: Math.floor(monthsLeft / 12) })
                  : t("registerResults.monthsLeft", { count: monthsLeft })}
              </span>
            )}
          </div>
          <span
            aria-hidden
            className="relative h-2 overflow-hidden rounded-full bg-foreground/[0.08] dark:bg-white/[0.08]"
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 origin-left animate-[meter-in_900ms_var(--ease-enter)_both] rounded-full",
                TERM_BAR[entry.status] ?? "bg-foreground/30",
              )}
              style={{ width: `${Math.max(4, progress * 100)}%` }}
            />
          </span>
          <div className="flex justify-between text-xs num text-muted-foreground">
            <span>{formatDay(entry.issuedAt, locale)}</span>
            <span>{formatDay(entry.expiresAt, locale)}</span>
          </div>
        </div>

        {/* Fields */}
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(({ label, value, mono }) => (
            <div key={label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={cn("font-medium break-words", mono && "font-mono num")}>{value}</dd>
            </div>
          ))}
        </dl>

        {(entry.category === "RERA" || conditions.length > 0) && (
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={t("registerResults.fields.conditions")}
          >
            {entry.category === "RERA" && (
              <li className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
                {t("licence.referralOnly")}
              </li>
            )}
            {conditions.map((c, i) => (
              <li
                key={i}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium dark:bg-white/[0.05]"
              >
                {c.code === "CUSTOM"
                  ? c.text
                  : `${t(`conditions.${c.code}`)}${c.text ? ` — ${c.text}` : ""}`}
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={verifyPath as Route}
            className="group inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
          >
            <ShieldCheck className="size-4" aria-hidden />
            {t("registry.openVerification")}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
          {onLocate && entry.districtName && (
            <button
              type="button"
              onClick={onLocate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary-soft px-5 text-sm font-semibold text-primary-soft-foreground transition-colors hover:bg-primary/15"
            >
              <MapPin className="size-4" aria-hidden />
              {t("registry.showOnMap")}
            </button>
          )}
          <button
            type="button"
            onClick={share}
            aria-label={t("registry.share")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <Share2 className="size-4" aria-hidden />
            <span className="sm:sr-only">{t("registry.share")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
