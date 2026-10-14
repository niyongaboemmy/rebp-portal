import type { StatusTone } from "@rebp/contracts";
import { cn } from "@/lib/utils";
import { TONE_FILL } from "./tones";

/**
 * Horizontal meter with an optional target marker — e.g. experience "2 y of 3 y" (FR-WIZ-007)
 * or supervisees against the ratio limit (FR-FIRM-012). Exposed as an ARIA meter.
 */
export function Meter({
  value,
  max,
  target,
  tone,
  label,
  valueText,
  className,
}: {
  value: number;
  max: number;
  /** Draws a tick at this value (e.g. the requirement). */
  target?: number;
  /** Status tone, or "ember" for progress towards something (not a status). */
  tone?: StatusTone | "ember";
  label: React.ReactNode;
  /** Visible and announced value, e.g. "2 of 3 years". */
  valueText: string;
  className?: string;
}) {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold num text-muted-foreground">{valueText}</span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        aria-label={typeof label === "string" ? label : undefined}
        className="relative h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full origin-left animate-[meter-in_var(--dur-5)_var(--ease-enter)_both] rounded-full",
            tone === "ember" ? "bg-ember" : tone ? TONE_FILL[tone] : "bg-primary",
          )}
          style={{ transform: `scaleX(${ratio})` }}
        />
        {target !== undefined && max > 0 && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-foreground/60"
            style={{ left: `calc(${Math.min(100, (target / max) * 100)}% - 1px)` }}
          />
        )}
      </div>
    </div>
  );
}
