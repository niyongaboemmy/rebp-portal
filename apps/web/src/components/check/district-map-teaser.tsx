"use client";

import { ArrowRight, MapPin } from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DISTRICT_CENTRES } from "@/config/districts-geo";
import {
  RWANDA_PROVINCES,
  RWANDA_VIEW,
  projectRwanda,
  provinceKey,
  type ProvinceKey,
} from "@/config/rwanda-shape";
import { cn } from "@/lib/utils";

export interface TeaserDistrict {
  code: string;
  name: string;
  province: string;
  total: number;
  valid: number;
}

/** Seconds each district stays highlighted during the idle tour. */
const TOUR_MS = 2600;

/**
 * FR-REG-002 entry to the register map from the verify page: Rwanda's real province shapes
 * (geoBoundaries) with one bubble per district that has licensed practitioners, sized by count.
 * Provinces draw in, bubbles drop in one by one, then an idle tour lights up each district in
 * turn (paused while the pointer or keyboard is on the map, off for reduced motion). Hovering
 * lights the district's province and shows its numbers; a click opens the full map there.
 */
export function DistrictMapTeaser({ districts }: { districts: TeaserDistrict[] }) {
  const t = useTranslations("check.map");
  const [hot, setHot] = useState<string>();
  const [touring, setTouring] = useState<string>();
  const [paused, setPaused] = useState(false);

  const placed = districts
    .map((d) => ({ ...d, centre: DISTRICT_CENTRES[d.name], key: provinceKey(d.province) }))
    .filter((d): d is typeof d & { centre: [number, number] } => Boolean(d.centre))
    .sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...placed.map((d) => d.total));

  // Idle tour through the districts (largest first).
  const codes = placed.map((d) => d.code).join(",");
  useEffect(() => {
    const list = codes ? codes.split(",") : [];
    if (paused || list.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const start = setTimeout(() => setTouring(list[0]), 1800);
    const id = setInterval(() => {
      i = (i + 1) % list.length;
      setTouring(list[i]);
    }, TOUR_MS);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [codes, paused]);

  const active = hot ?? (paused ? undefined : touring);
  const current = placed.find((d) => d.code === active);
  const litProvince: ProvinceKey | undefined = current?.key;
  const provinceTotals = new Map<ProvinceKey, number>();
  for (const d of placed)
    if (d.key) provinceTotals.set(d.key, (provinceTotals.get(d.key) ?? 0) + d.total);

  return (
    <section
      aria-label={t("title")}
      className="relative isolate flex flex-col overflow-hidden rounded-[2rem] bg-card px-5 pt-14 pb-5 shadow-[0_1px_2px_oklch(0.3_0.08_264/0.06),0_24px_60px_-30px_oklch(0.35_0.15_264/0.4)] sm:px-6 sm:pb-6 dark:bg-white/[0.04] dark:shadow-none"
    >
      {/* Soft brand light behind the map. */}
      <div
        aria-hidden
        className="absolute top-1/3 left-1/2 -z-10 size-[28rem] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl dark:bg-primary/[0.12]"
      />
      {/* The map. */}
      <div
        className="relative"
        style={{ aspectRatio: `${RWANDA_VIEW.width} / ${RWANDA_VIEW.height}` }}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => {
          setPaused(false);
          setHot(undefined);
        }}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <svg
          viewBox={`0 0 ${RWANDA_VIEW.width} ${RWANDA_VIEW.height}`}
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden
        >
          <defs>
            <pattern id="rw-dots" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
              <circle cx="0.8" cy="0.8" r="0.22" className="fill-primary/25 dark:fill-white/20" />
            </pattern>
            <filter id="rw-shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow
                dx="0"
                dy="1.6"
                stdDeviation="1.6"
                floodColor="oklch(0.35 0.15 264)"
                floodOpacity="0.25"
              />
            </filter>
          </defs>
          {/* Outer border: a thick stroke under the fills (inner edges get covered). */}
          <g filter="url(#rw-shadow)">
            {RWANDA_PROVINCES.map((p) => (
              <path
                key={`b-${p.key}`}
                d={p.d}
                className="fill-card stroke-primary/45 dark:fill-[oklch(0.22_0.03_265)] dark:stroke-white/30"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            ))}
          </g>
          {/* Provinces: draw in, then light up with the active district. */}
          {RWANDA_PROVINCES.map((p, i) => {
            const lit = litProvince === p.key;
            return (
              <g key={p.key}>
                <path
                  d={p.d}
                  strokeLinejoin="round"
                  strokeWidth="0.35"
                  style={{ animationDelay: `${i * 120}ms` }}
                  className={cn(
                    "animate-[province-in_700ms_var(--ease-enter)_both] stroke-white transition-[fill] duration-500 dark:stroke-[oklch(0.16_0.02_265)]",
                    lit
                      ? "fill-primary/25 dark:fill-primary/35"
                      : provinceTotals.get(p.key)
                        ? "fill-primary/[0.1] dark:fill-primary/[0.16]"
                        : "fill-foreground/[0.04] dark:fill-white/[0.04]",
                  )}
                />
                <path d={p.d} fill="url(#rw-dots)" className="pointer-events-none" />
              </g>
            );
          })}
        </svg>

        {/* Attribution (geoBoundaries, CC BY 4.0), kept but out of the way. */}
        <span
          title={t("credit")}
          className="absolute right-0 bottom-0 z-10 inline-flex size-5 cursor-help items-center justify-center rounded-full bg-foreground/[0.06] text-[0.6rem] font-bold text-muted-foreground"
        >
          i<span className="sr-only">{t("credit")}</span>
        </span>
        {/* District bubbles. */}
        <ul className="absolute inset-0">
          {placed.map((d, i) => {
            const { x, y } = projectRwanda(d.centre);
            const size = 1.7 + (d.total / max) * 1.5;
            const on = d.code === active;
            return (
              <li
                key={d.code}
                className={cn("absolute -translate-x-1/2 -translate-y-1/2", on && "z-10")}
                style={{
                  left: `${(x / RWANDA_VIEW.width) * 100}%`,
                  top: `${(y / RWANDA_VIEW.height) * 100}%`,
                }}
              >
                <Link
                  href={`/register?district=${encodeURIComponent(d.code)}` as Route}
                  onPointerEnter={() => setHot(d.code)}
                  onFocus={() => setHot(d.code)}
                  onBlur={() => setHot(undefined)}
                  aria-label={t("districtAria", { district: d.name, count: d.total })}
                  style={{
                    width: `${size}rem`,
                    height: `${size}rem`,
                    animationDelay: `${700 + i * 110}ms`,
                  }}
                  className={cn(
                    "relative grid animate-[map-drop_640ms_var(--ease-spring)_backwards] place-items-center rounded-full text-[0.7rem] font-bold text-white ring-2 transition-[transform,box-shadow,background] duration-(--dur-3) ease-spring outline-none",
                    on
                      ? "scale-115 bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklch,var(--sun)_80%,white),var(--ember)_75%)] shadow-[0_10px_22px_-8px_oklch(0.55_0.17_50/0.8)] ring-white"
                      : "bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklch,var(--sky)_85%,white),var(--primary)_70%)] shadow-[0_8px_18px_-8px_oklch(0.35_0.18_264/0.8)] ring-white/90 dark:ring-white/25",
                  )}
                >
                  <span
                    aria-hidden
                    data-loop
                    className={cn(
                      "absolute -inset-2 animate-ping rounded-full border-2 [animation-duration:2.6s]",
                      on ? "border-sun/70" : "border-primary/30",
                    )}
                  />
                  <span className="relative num">{d.total}</span>
                </Link>
                {/* Label + numbers for the active district. */}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute bottom-[calc(100%+0.6rem)] left-1/2 flex -translate-x-1/2 flex-col items-center rounded-2xl bg-foreground/90 px-3 py-1.5 text-center text-xs whitespace-nowrap text-background shadow-lg backdrop-blur transition-[opacity,translate] duration-(--dur-3) ease-spring",
                    on ? "translate-y-0 opacity-100" : "invisible translate-y-1 opacity-0",
                  )}
                >
                  <span className="font-semibold">{d.name}</span>
                  <span className="opacity-80">{t("tip", { total: d.total, valid: d.valid })}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <Link
        href={"/register" as Route}
        className="group mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)]"
      >
        <MapPin className="size-4" aria-hidden />
        {t("cta")}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
    </section>
  );
}
