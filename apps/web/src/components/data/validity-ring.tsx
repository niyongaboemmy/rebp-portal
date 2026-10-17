import type { StatusTone } from "@rebp/contracts";
import { cn } from "@/lib/utils";
import { ProgressRing } from "./progress-ring";

/**
 * Tone for a countdown (FR-PORTAL-004): the primary family while there is time, red in the last
 * 30 days. The renewal notice carries the "renew soon" nudge, so the ring stays calm (UX-031).
 */
export function validityTone(daysLeft: number): StatusTone {
  if (daysLeft <= 30) return "critical";
  return "good";
}

/** Licence validity as a countdown ring: days left in the centre, arc = share of term left. */
export function ValidityRing({
  daysLeft,
  totalDays = 365,
  unit,
  label,
  className,
}: {
  daysLeft: number;
  totalDays?: number;
  /** Short unit under the number, e.g. "days". */
  unit: string;
  label: string;
  className?: string;
}) {
  return (
    <ProgressRing
      value={Math.max(0, daysLeft)}
      total={totalDays}
      tone={validityTone(daysLeft)}
      thickness={3}
      label={label}
      className={cn("size-24", className)}
    >
      <span className="text-2xl font-bold num">{Math.max(0, daysLeft)}</span>
      <span className="mt-1 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {unit}
      </span>
    </ProgressRing>
  );
}
