"use client";

import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TrendSeries {
  key: string;
  label: string;
  /** A CSS colour, usually a token: `var(--primary)`. */
  color: string;
  values: number[];
  /** Draw a soft area under the line (one series at most, for clarity). */
  area?: boolean;
  dashed?: boolean;
}

/** Monotone-ish smoothing: Catmull-Rom converted to cubic Béziers, clamped to the chart floor. */
function smoothPath(points: [number, number][], floor: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0]![0]},${points[0]![1]}`;
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1y = Math.min(floor, p1[1] + (p2[1] - p0[1]) / 6);
    const c2y = Math.min(floor, p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${c1y} ${p2[0] - (p3[0] - p1[0]) / 6},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const W = 600;
const H = 200;

/**
 * Interactive trend chart (UX-040): smooth lines drawn in, a soft area, and a crosshair that follows
 * the pointer — or the arrow keys when focused — with a tooltip of every series at that day. Text
 * lives in HTML, not the stretched SVG, so labels never distort. An sr-only table carries the data.
 */
export function TrendChart({
  series,
  labels,
  label,
  height = 200,
  className,
  compact = false,
}: {
  series: TrendSeries[];
  /** One label per point (dates), already formatted. */
  labels: string[];
  /** Accessible name of the chart. */
  label: string;
  height?: number;
  className?: string;
  /** Hide axes and gridlines (sparkline-sized use). */
  compact?: boolean;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const count = labels.length;
  const max = useMemo(
    () => Math.max(1, ...series.flatMap((s) => s.values)) * (compact ? 1.1 : 1.2),
    [series, compact],
  );
  const x = (i: number) => (count <= 1 ? W / 2 : (i / (count - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  const paths = series.map((s) => {
    const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
    const line = smoothPath(pts, H);
    return { ...s, line, area: s.area ? `${line} L${W},${H} L0,${H} Z` : null };
  });

  const pick = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || count === 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setActive(Math.round(ratio * (count - 1)));
  };
  const onKey = (event: React.KeyboardEvent) => {
    if (count === 0) return;
    const current = active ?? count - 1;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(0, current - 1)
        : event.key === "ArrowRight"
          ? Math.min(count - 1, current + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? count - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  const ticks = compact ? [] : [0, 0.5, 1];
  const xTicks = compact
    ? []
    : count <= 8
      ? labels.map((_, i) => i)
      : [0, Math.round((count - 1) / 2), count - 1];
  const left = active === null ? 0 : (x(active) / W) * 100;

  return (
    <figure className={cn("relative flex flex-col gap-2", className)}>
      <div
        ref={box}
        role="img"
        aria-label={label}
        tabIndex={compact ? -1 : 0}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((a) => a ?? count - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
        className={cn(
          "relative touch-pan-y rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
          !compact && "ml-8",
        )}
        style={{ height }}
      >
        {ticks.map((t) => (
          <div
            key={t}
            aria-hidden
            className="absolute inset-x-0 border-t border-dashed border-foreground/[0.08] dark:border-white/[0.08]"
            style={{ top: `${(1 - t / 1.2) * 100}%` }}
          >
            <span className="absolute -top-2 -left-8 w-6 text-right text-[0.625rem] num text-muted-foreground">
              {Math.round((max / 1.2) * t)}
            </span>
          </div>
        ))}
        <svg
          aria-hidden
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            {paths.map((p) => (
              <linearGradient key={p.key} id={`${id}-${p.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={p.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={p.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {paths.map(
            (p) =>
              p.area && (
                <path
                  key={`${p.key}-area`}
                  d={p.area}
                  fill={`url(#${id}-${p.key})`}
                  className="animate-in duration-700 fade-in"
                />
              ),
          )}
          {paths.map((p) => (
            <path
              key={p.key}
              d={p.line}
              fill="none"
              stroke={p.color}
              strokeWidth={compact ? 2 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={p.dashed ? "6 6" : undefined}
              vectorEffect="non-scaling-stroke"
              pathLength={p.dashed ? undefined : 1}
              className={p.dashed ? undefined : "trend-draw"}
            />
          ))}
        </svg>
        {active !== null && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-foreground/15"
              style={{ left: `${left}%` }}
            />
            {series.map((s) => (
              <span
                key={s.key}
                aria-hidden
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                style={{
                  left: `${left}%`,
                  top: `${(y(s.values[active] ?? 0) / H) * 100}%`,
                  background: s.color,
                }}
              />
            ))}
            {!compact && (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-0 z-10 flex min-w-32 flex-col gap-1 rounded-xl bg-popover px-3 py-2 text-xs shadow-(--overlay)",
                  left > 60 ? "-translate-x-[calc(100%+0.75rem)]" : "translate-x-3",
                )}
                style={{ left: `${left}%` }}
              >
                <span className="font-semibold text-muted-foreground">{labels[active]}</span>
                {series.map((s) => (
                  <span key={s.key} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1">{s.label}</span>
                    <span className="font-bold num">{s.values[active] ?? 0}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {xTicks.length > 0 && (
        <div aria-hidden className="relative ml-8 h-4 text-[0.625rem] text-muted-foreground">
          {xTicks.map((i) => (
            <span
              key={i}
              className={cn(
                "absolute whitespace-nowrap",
                i === 0 ? "" : i === count - 1 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${(x(i) / W) * 100}%` }}
            >
              {labels[i]}
            </span>
          ))}
        </div>
      )}
      {/* sr-only on a wrapper: a table ignores width:1px and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col" />
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((l, i) => (
              <tr key={`${l}-${i}`}>
                <th scope="row">{l}</th>
                {series.map((s) => (
                  <td key={s.key}>{s.values[i] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
