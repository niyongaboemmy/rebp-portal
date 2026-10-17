import type { CategoryTier, LicenseStatus } from "@rebp/contracts";

/** Avatar / accent wash per tier: sky for entry, blue for agents, deep blue for brokers, Ember for firms. */
export const TIER_TILE: Record<CategoryTier, string> = {
  entry:
    "bg-[linear-gradient(140deg,var(--sky),color-mix(in_oklch,var(--sky)_60%,var(--primary)))]",
  agent:
    "bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--primary)_65%,var(--sky)))]",
  broker:
    "bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_85%,black),var(--primary))]",
  firm: "bg-[linear-gradient(140deg,var(--ember),color-mix(in_oklch,var(--ember)_70%,var(--sun)))]",
};

/** Term bar colour by status. */
export const TERM_BAR: Partial<Record<LicenseStatus, string>> = {
  ACTIVE: "bg-[linear-gradient(90deg,var(--primary),var(--sky))]",
  SUSPENDED: "bg-warning",
  REVOKED: "bg-destructive",
};

/** Small status dots (filters, previews). */
export const STATUS_DOT: Partial<Record<LicenseStatus, string>> = {
  ACTIVE: "bg-success",
  SUSPENDED: "bg-warning",
  REVOKED: "bg-destructive",
  EXPIRED: "bg-foreground/35",
};

/**
 * Preview hero: the tier wash in light mode; in dark mode a deep, tier-tinted night surface (the
 * light tier colours wash white text out on dark screens), with the tier colour as a glow.
 */
export const TIER_HERO: Record<CategoryTier, string> = {
  entry: `${TIER_TILE.entry} dark:bg-[linear-gradient(140deg,color-mix(in_oklch,var(--sky)_32%,oklch(0.2_0.03_255)),oklch(0.19_0.025_260))]`,
  agent: `${TIER_TILE.agent} dark:bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_38%,oklch(0.19_0.03_265)),oklch(0.18_0.025_265))]`,
  broker: `${TIER_TILE.broker} dark:bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_28%,oklch(0.17_0.03_268)),oklch(0.16_0.02_268))]`,
  firm: `${TIER_TILE.firm} dark:bg-[linear-gradient(140deg,color-mix(in_oklch,var(--ember)_30%,oklch(0.19_0.025_50)),oklch(0.18_0.02_260))]`,
};

/** Term ring stroke by status (SVG `stroke` classes). */
export const TERM_RING: Partial<Record<LicenseStatus, string>> = {
  ACTIVE: "stroke-primary dark:stroke-sky",
  SUSPENDED: "stroke-warning",
  REVOKED: "stroke-destructive",
};
