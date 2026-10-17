"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** A CSS colour, usually a token. */
  color: string;
  /** Where acting on this segment leads (e.g. the queue filtered to it). */
  href?: Route;
  /** The button text for that destination ("Review overdue files"). */
  action?: string;
}

/**
 * Interactive donut (UX-040). Segments are drawn with rounded gaps and grow in; hovering a segment
 * or focusing its legend entry lifts it and swaps the centre to its value. Colour is never the only
 * cue: the legend names every segment with its count.
 */
export function Donut({
  segments,
  label,
  center,
  size = 148,
  thickness = 10,
  legend = true,
  hint,
  className,
}: {
  segments: DonutSegment[];
  label: string;
  /** Centre content when nothing is highlighted. */
  center: React.ReactNode;
  size?: number;
  thickness?: number;
  legend?: boolean;
  /** Guidance shown under the legend until a segment is selected ("Select a slice to act"). */
  hint?: string;
  className?: string;
}) {
  // Hover previews a segment; a click or Enter selects it and offers its destination.
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const active = hovered ?? selected;
  const toggle = (key: string) => setSelected((current) => (current === key ? null : key));
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = 50 - thickness / 2 - 2;
  const circumference = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 2.2 : 0;
  const arcs = visible.map((s, i) => {
    const before = visible.slice(0, i).reduce((sum, v) => sum + v.value, 0);
    const length = (s.value / Math.max(1, total)) * circumference;
    return {
      ...s,
      dash: Math.max(0.01, length - gap),
      offset: (before / Math.max(1, total)) * circumference,
    };
  });
  const focus = segments.find((s) => s.key === active);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-4", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={label}>
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={thickness}
            className="text-foreground/[0.06] dark:text-white/[0.07]"
          />
          {arcs.map((a, i) => (
            <circle
              key={a.key}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={active === a.key ? thickness + 3 : thickness}
              strokeLinecap="round"
              strokeDasharray={`${a.dash} ${circumference}`}
              strokeDashoffset={-a.offset}
              onPointerEnter={() => setHovered(a.key)}
              onPointerLeave={() => setHovered(null)}
              onClick={() => toggle(a.key)}
              className="donut-grow cursor-pointer transition-[stroke-width,opacity] duration-(--dur-2)"
              style={{
                opacity: active && active !== a.key ? 0.35 : 1,
                animationDelay: `${i * 90}ms`,
              }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {focus ? (
            <>
              <span className="text-2xl font-bold num">{focus.value}</span>
              <span className="max-w-[70%] text-[0.65rem] leading-tight text-muted-foreground">
                {focus.label}
              </span>
            </>
          ) : (
            center
          )}
        </div>
      </div>
      {legend && (
        <ul className="flex min-w-36 flex-1 flex-col gap-1">
          {segments.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                aria-pressed={selected === s.key}
                onClick={() => toggle(s.key)}
                onPointerEnter={() => setHovered(s.key)}
                onPointerLeave={() => setHovered(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors outline-none hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring/40",
                  active === s.key && "bg-foreground/[0.04] dark:bg-white/[0.05]",
                  selected === s.key && "ring-1 ring-foreground/10 dark:ring-white/15",
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
                <span className="font-bold num">{s.value}</span>
              </button>
            </li>
          ))}
          <SegmentAction segment={segments.find((s) => s.key === selected)} hint={hint} />
        </ul>
      )}
    </div>
  );
}

/** The selected segment's next step, or the guidance to pick one. */
function SegmentAction({ segment, hint }: { segment?: DonutSegment; hint?: string }) {
  if (segment?.href && segment.action && segment.value > 0)
    return (
      <li className="pt-1">
        <Link
          href={segment.href}
          className="group inline-flex h-8 animate-in items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors fade-in slide-in-from-top-1 hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          {segment.action}
          <ArrowRight
            aria-hidden
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </li>
    );
  if (!hint) return null;
  return <li className="px-2 pt-1 text-[0.6875rem] text-muted-foreground">{hint}</li>;
}
