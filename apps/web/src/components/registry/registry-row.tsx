"use client";

import { BookUser, Building2, ChevronRight, MapPin, ShieldCheck } from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { CATEGORY_INFO } from "@rebp/contracts";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { formatDay } from "@/lib/format";
import { initials, termProgress, type PublicEntry } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { useRegistryPreview } from "./registry-preview";
import { STATUS_DOT, TERM_RING, TIER_TILE } from "./tones";

const RING_R = 22.5;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Initials avatar wrapped in a ring that shows how much of the licence term has run. The ring
 * draws in on mount and takes the status colour (blue valid, amber suspended, red revoked).
 */
export function TermAvatar({
  entry,
  progress,
  label,
  delay = 0,
  className,
}: {
  entry: PublicEntry;
  progress: number;
  /** Accessible summary of the term (e.g. "8 months left"). */
  label: string;
  delay?: number;
  className?: string;
}) {
  const tier = CATEGORY_INFO[entry.category].tier;
  return (
    <span className={cn("relative inline-flex size-12 shrink-0", className)} title={label}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle
          cx="24"
          cy="24"
          r={RING_R}
          fill="none"
          strokeWidth="2.5"
          className="stroke-foreground/[0.08] dark:stroke-white/[0.1]"
        />
        <circle
          cx="24"
          cy="24"
          r={RING_R}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - Math.max(0.03, progress))}
          style={
            {
              "--ring-c": `${RING_C}px`,
              animation: `ring-in 1s var(--ease-enter) ${delay}ms both`,
            } as React.CSSProperties
          }
          className={TERM_RING[entry.status] ?? "stroke-foreground/30"}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-[5px] inline-flex items-center justify-center rounded-full text-[0.8rem] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-transform duration-(--dur-3) ease-spring group-hover/row:scale-105",
          TIER_TILE[tier],
        )}
      >
        {initials(entry.displayName)}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Reusable registry entry row (FR-REG-003: public fields only) for list groups: a term-ring
 * avatar, name, category and district, the licence number with time left (when there is room)
 * and the status. The row opens the large preview (the same dialog the map and search use);
 * the shield goes straight to the verification page.
 */
export function RegistryRow({ entry, index = 0 }: { entry: PublicEntry; index?: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const preview = useRegistryPreview();
  const [now] = useState(() => Date.now());
  const { progress, monthsLeft } = termProgress(entry.issuedAt, entry.expiresAt, now);
  const active = entry.status === "ACTIVE";
  const left = active
    ? monthsLeft >= 12
      ? t("registerResults.yearsLeft", { count: Math.floor(monthsLeft / 12) })
      : t("registerResults.monthsLeft", { count: monthsLeft })
    : formatDay(entry.expiresAt, locale);
  const delay = Math.min(index, 10) * 40;

  return (
    <li className="animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <article
        data-district={entry.district ?? undefined}
        className="group/row relative flex items-center gap-1 rounded-2xl pr-2 transition-colors duration-(--dur-2) hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05]"
      >
        <button
          type="button"
          onClick={() => preview.open(entry)}
          aria-label={t("registry.openPreview", { name: entry.displayName })}
          className="flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl py-2.5 pl-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <TermAvatar entry={entry} progress={progress} label={left} delay={200 + delay} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-semibold">{entry.displayName}</span>
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full @md:hidden",
                  STATUS_DOT[entry.status] ?? "bg-foreground/30",
                )}
              />
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {entry.kind === "FIRM" ? (
                <Building2 className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <BookUser className="size-3.5 shrink-0" aria-hidden />
              )}
              <span className="truncate">{t(`categories.short.${entry.category}`)}</span>
              <span className="font-mono font-bold text-link">
                {CATEGORY_INFO[entry.category].section}
              </span>
              {entry.districtName && (
                <>
                  <span aria-hidden className="text-foreground/20">
                    •
                  </span>
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{entry.districtName}</span>
                </>
              )}
            </span>
          </span>
          <span className="hidden shrink-0 flex-col items-end gap-0.5 @xl:flex">
            <span className="font-mono text-sm font-semibold num tracking-tight">
              {entry.licenceNo}
            </span>
            <span className="text-xs num text-muted-foreground">{left}</span>
          </span>
          <LicenceStatusBadge status={entry.status} className="hidden shrink-0 @md:inline-flex" />
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-(--dur-2) group-hover/row:translate-x-0.5 group-hover/row:text-foreground"
          />
        </button>
        <Link
          href={`/check/${encodeURIComponent(entry.licenceNo)}` as Route}
          aria-label={`${t("registerResults.verify")}: ${entry.licenceNo}`}
          title={t("registerResults.verify")}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-link transition-[background-color,color,transform] outline-none hover:bg-primary hover:text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-90"
        >
          <ShieldCheck className="size-[1.1rem]" aria-hidden />
        </Link>
      </article>
    </li>
  );
}
