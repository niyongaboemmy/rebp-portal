import { cn } from "@/lib/utils";

/**
 * Tiny trend line (2 px stroke, end dot, no axes). Decorative: the tile that hosts it states
 * the number in text. The line draws itself in on first paint (CSS stroke-dashoffset).
 */
export function Sparkline({
  points,
  className,
  height = 32,
  width = 96,
}: {
  points: number[];
  className?: string;
  height?: number;
  width?: number;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const step = width / (points.length - 1);
  const pad = 3;
  const coords = points.map(
    (p, i) => [i * step, pad + (height - pad * 2) * (1 - p / max)] as const,
  );
  const d = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1]!;
  return (
    <svg
      viewBox={`-3 0 ${width + 6} ${height}`}
      className={cn("h-8 w-24 overflow-visible text-link", className)}
      aria-hidden
    >
      <path d={`${d} L${width} ${height} L0 ${height} Z`} className="fill-current opacity-10" />
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={100}
        className="animate-draw"
      />
      <circle cx={lastX} cy={lastY} r="3" className="fill-current stroke-card" strokeWidth="2" />
    </svg>
  );
}
