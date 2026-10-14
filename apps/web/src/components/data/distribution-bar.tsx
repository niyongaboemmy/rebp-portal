import { cn } from "@/lib/utils";

export interface Segment {
  key: string;
  label: string;
  value: number;
}

/** Categorical slots in fixed order (never cycled): series n always gets --chart-n. */
const SLOT_BG = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
];

/**
 * One stacked bar for a part-to-whole split (queue by status, register by category), with a
 * 2 px surface gap between segments, a legend that carries identity and values in text, and
 * an sr-only table (dataviz: identity is never colour-alone). At most 8 segments.
 */
export function DistributionBar({
  segments,
  label,
  className,
}: {
  segments: Segment[];
  label: string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.slice(0, 8);
  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "flex h-3 w-full gap-0.5 overflow-hidden rounded-full",
          total === 0 && "bg-muted",
        )}
        aria-hidden
      >
        {total > 0 &&
          visible
            .filter((s) => s.value > 0)
            .map((s) => (
              <span
                key={s.key}
                className={cn(
                  "h-full origin-left animate-[meter-in_var(--dur-5)_var(--ease-enter)_both] first:rounded-l-full last:rounded-r-full",
                  SLOT_BG[segments.indexOf(s)],
                )}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value}`}
              />
            ))}
      </div>
      <figcaption className="sr-only">{label}</figcaption>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3" aria-hidden>
        {visible.map((s, i) => (
          <li key={s.key} className="flex min-w-0 items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-full", SLOT_BG[i])} />
            <span className="truncate text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-semibold num">{s.value}</span>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {visible.map((s) => (
            <tr key={s.key}>
              <th scope="row">{s.label}</th>
              <td>{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
