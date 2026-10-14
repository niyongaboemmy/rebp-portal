import type { StatusTone } from "@rebp/contracts";
import { cn } from "@/lib/utils";
import { TONE_STROKE } from "./tones";

const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular progress (application completion, checklists, setup). The arc fills from empty on
 * first paint (CSS only — no JS). The SVG is decorative: pass `label` for the accessible text,
 * and put the visible value in `children` (rendered in the centre).
 */
export function ProgressRing({
  value,
  total = 1,
  tone,
  thickness = 3.5,
  className,
  label,
  children,
}: {
  value: number;
  total?: number;
  /** Defaults to the brand primary. */
  tone?: StatusTone;
  thickness?: number;
  className?: string;
  /** Accessible description, e.g. "4 of 7 documents uploaded". */
  label?: string;
  children?: React.ReactNode;
}) {
  const ratio = total <= 0 ? 0 : Math.min(1, Math.max(0, value / total));
  return (
    <span
      className={cn("relative inline-grid size-12 shrink-0 place-items-center", className)}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth={thickness}
          className="stroke-muted"
        />
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          className={cn(
            "animate-[ring-in_var(--dur-5)_var(--ease-enter)_both] transition-[stroke-dashoffset] duration-(--dur-5) ease-enter",
            tone ? TONE_STROKE[tone] : "stroke-primary",
            ratio === 0 && "opacity-0",
          )}
          style={{ "--ring-c": CIRCUMFERENCE } as React.CSSProperties}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
        />
      </svg>
      {children && (
        <span className="relative flex flex-col items-center leading-none">{children}</span>
      )}
    </span>
  );
}
