import { cn } from "@/lib/utils";

/** Small circular progress (decorative; the numbers are always shown as text too). */
export function ProgressRing({
  value,
  total,
  className,
}: {
  value: number;
  total: number;
  className?: string;
}) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 0 : value / total;
  return (
    <svg viewBox="0 0 40 40" className={cn("size-11 -rotate-90", className)} aria-hidden>
      <circle cx="20" cy="20" r={radius} fill="none" strokeWidth="4" className="stroke-muted" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
      />
    </svg>
  );
}
