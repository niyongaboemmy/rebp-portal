import {
  CircleCheck,
  CircleDashed,
  Clock3,
  OctagonX,
  TriangleAlert,
  type LucideIcon,
} from "@/components/icons";
import type { StatusTone } from "@rebp/contracts";

/**
 * Visual language for status tones (ADR-009). Colour is always paired with an icon and a
 * label, so state never relies on colour alone (WCAG 1.4.1).
 */
export const TONE_ICONS: Record<StatusTone, LucideIcon> = {
  good: CircleCheck,
  warning: TriangleAlert,
  critical: OctagonX,
  info: Clock3,
  neutral: CircleDashed,
};

/** Text colour of the tone (≥ 4.5:1 on cards and on its soft background). */
export const TONE_TEXT: Record<StatusTone, string> = {
  good: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
  info: "text-info",
  neutral: "text-muted-foreground",
};

export const TONE_SOFT_BG: Record<StatusTone, string> = {
  good: "bg-success-soft",
  warning: "bg-warning-soft",
  critical: "bg-danger-soft",
  info: "bg-info-soft",
  neutral: "bg-muted",
};

/** Stroke colour for rings, meters and timeline nodes. */
export const TONE_STROKE: Record<StatusTone, string> = {
  good: "stroke-success",
  warning: "stroke-warning",
  critical: "stroke-destructive",
  info: "stroke-info",
  neutral: "stroke-muted-foreground",
};

export const TONE_FILL: Record<StatusTone, string> = {
  good: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};
