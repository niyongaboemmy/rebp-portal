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
 * label, so state never relies on colour alone (WCAG 1.4.1). "All good" and "in progress" are
 * the primary family (UX-007/027): red is kept for what blocks, amber for real warnings.
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
  good: "text-link",
  warning: "text-warning",
  critical: "text-destructive",
  info: "text-link",
  neutral: "text-muted-foreground",
};

export const TONE_SOFT_BG: Record<StatusTone, string> = {
  good: "bg-primary-soft",
  warning: "bg-warning-soft",
  critical: "bg-danger-soft",
  info: "bg-primary-soft",
  neutral: "bg-muted",
};

/** Stroke colour for rings, meters and timeline nodes. */
export const TONE_STROKE: Record<StatusTone, string> = {
  good: "stroke-primary",
  warning: "stroke-warning",
  critical: "stroke-destructive",
  info: "stroke-primary/60",
  neutral: "stroke-muted-foreground",
};

export const TONE_FILL: Record<StatusTone, string> = {
  good: "bg-primary",
  warning: "bg-warning",
  critical: "bg-destructive",
  info: "bg-primary/60",
  neutral: "bg-muted-foreground",
};

/** A thin accent rule in the tone (messages that sit on the card without a heavy fill). */
export const TONE_BORDER: Record<StatusTone, string> = {
  good: "border-primary",
  warning: "border-warning",
  critical: "border-destructive",
  info: "border-primary/60",
  neutral: "border-foreground/20",
};
