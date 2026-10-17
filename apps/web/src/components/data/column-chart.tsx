"use client";

import { useFormatter } from "next-intl";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface Column {
  /** ISO date or category key. */
  key: string;
  /** Short axis label. */
  label: string;
  value: number;
}

/**
 * Single-series column chart (e.g. activity per day). One y-baseline, 4 px rounded data ends,
 * hover/focus tooltip with hit targets wider than the bars, sparse x labels, and a
 * "view as table" equivalent for screen readers (dataviz method).
 */
export function ColumnChart({
  columns,
  label,
  valueLabel,
  className,
}: {
  columns: Column[];
  label: string;
  /** Name of the measure, used in the tooltip and table header. */
  valueLabel: string;
  className?: string;
}) {
  const format = useFormatter();
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...columns.map((c) => c.value));
  const labelEvery = Math.ceil(columns.length / 7);

  return (
    <figure className={cn("relative flex min-w-0 flex-col gap-2", className)}>
      <figcaption className="sr-only">{label}</figcaption>
      <div className="relative h-36" onMouseLeave={() => setActive(null)}>
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" aria-hidden />
        <div className="absolute inset-0 flex items-end gap-1" aria-hidden>
          {columns.map((c, i) => (
            <div
              key={c.key}
              className="group relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setActive(i)}
            >
              <span
                className={cn(
                  "w-full max-w-6 origin-bottom animate-[bar-in_var(--dur-5)_var(--ease-enter)_both] rounded-t-[4px] transition-colors",
                  active === i ? "bg-primary" : "bg-primary/80",
                  c.value === 0 && "bg-border",
                )}
                style={{
                  height: `${Math.max(2, (c.value / max) * 100)}%`,
                  animationDelay: `${i * 20}ms`,
                }}
              />
            </div>
          ))}
        </div>
        {active !== null && columns[active] && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-foreground px-2.5 py-1.5 text-xs whitespace-nowrap text-background shadow-3"
            style={{ left: `${((active + 0.5) / columns.length) * 100}%` }}
            aria-hidden
          >
            <span className="font-semibold num">{format.number(columns[active].value)}</span>{" "}
            {valueLabel} · {columns[active].label}
          </div>
        )}
      </div>
      <div className="flex gap-1 text-[0.7rem] text-muted-foreground" aria-hidden>
        {columns.map((c, i) => (
          <span key={c.key} className="flex-1 text-center num">
            {i % labelEvery === 0 || i === columns.length - 1 ? c.label : ""}
          </span>
        ))}
      </div>
      {/* Tables ignore sr-only's 1px width; the wrapper clips it (UX-035). */}
      <div className="sr-only">
        <table aria-describedby={id}>
          <caption id={id}>{label}</caption>
          <thead>
            <tr>
              <th scope="col">{label}</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c) => (
              <tr key={c.key}>
                <th scope="row">{c.label}</th>
                <td>{c.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
