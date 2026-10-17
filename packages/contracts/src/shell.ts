import { z } from "zod";

/**
 * Viewer layout preferences for the authenticated shell (UX-001, ADR-011). Cosmetic and free of
 * PII; stored in one cookie that the server reads for the first paint and the client rewrites.
 * Unknown or malformed values fall back to the defaults instead of failing.
 */
export const SHELL_PREFS_COOKIE = "rebp_shell";

export const SIDEBAR_MODES = ["auto", "expanded", "collapsed"] as const;
export const DENSITIES = ["comfortable", "compact"] as const;
export const CONTENT_WIDTHS = ["default", "full"] as const;
/** Expanded sidebar width in px, resizable by the viewer (default 256 = 16rem). */
export const SIDEBAR_WIDTH = { min: 224, max: 320, default: 256 } as const;

export const ShellPrefs = z.object({
  /** `auto`: the viewport decides (collapsed below 80rem, expanded above). */
  sidebar: z.enum(SIDEBAR_MODES).catch("auto"),
  density: z.enum(DENSITIES).catch("comfortable"),
  width: z.enum(CONTENT_WIDTHS).catch("default"),
  sidebarWidth: z.coerce
    .number()
    .int()
    .min(SIDEBAR_WIDTH.min)
    .max(SIDEBAR_WIDTH.max)
    .catch(SIDEBAR_WIDTH.default),
});
export type ShellPrefs = z.infer<typeof ShellPrefs>;
export type SidebarMode = ShellPrefs["sidebar"];

export const DEFAULT_SHELL_PREFS: ShellPrefs = ShellPrefs.parse({});

/** Reads the cookie value (`sidebar=collapsed&density=compact&width=default`). */
export function parseShellPrefs(raw: string | undefined | null): ShellPrefs {
  if (!raw) return DEFAULT_SHELL_PREFS;
  const fields: Record<string, string> = {};
  for (const pair of raw.split("&")) {
    const [key, value] = pair.split("=");
    if (key && value) fields[key] = value;
  }
  return ShellPrefs.parse(fields);
}

/** Cookie-safe value: no commas, semicolons or spaces. */
export function serializeShellPrefs(prefs: ShellPrefs): string {
  return Object.entries(prefs)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}
