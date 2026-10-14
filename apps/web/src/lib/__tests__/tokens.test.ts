import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../color";

/**
 * UX-002 / WCAG 2.2 AA: every foreground/background pair the components use is computed from
 * the real tokens in globals.css, in both themes. A token change that breaks contrast fails CI.
 */
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No ${selector} block`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[match[1]!] = match[2]!.trim();
  return vars;
}

const light = block(":root");
const dark = { ...light, ...block(".dark") };

function resolveToken(theme: Record<string, string>, name: string): string {
  let value = theme[name];
  for (let i = 0; value?.startsWith("var(") && i < 5; i++) value = theme[value.slice(6, -1)];
  if (!value) throw new Error(`Unknown token --${name}`);
  return value;
}

/** [foreground, background] — text pairs need 4.5:1. */
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "popover"],
  ["foreground", "surface-3"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "surface-3"],
  ["primary", "background"],
  ["primary", "card"],
  ["primary-foreground", "primary"],
  ["primary-soft-foreground", "primary-soft"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["sun-foreground", "sun"],
  ["sky", "card"],
  ["sky", "background"],
  ["success", "card"],
  ["success", "success-soft"],
  ["warning", "card"],
  ["warning", "warning-soft"],
  ["destructive", "card"],
  ["destructive", "danger-soft"],
  ["destructive-foreground", "destructive"],
  ["info", "info-soft"],
  ["foreground", "sidebar"],
  ["foreground", "sidebar-accent"],
];

/** UI component boundaries and focus indicators need 3:1 (WCAG 1.4.11). */
const UI_PAIRS: [string, string][] = [
  ["input", "card"],
  ["input", "background"],
  ["ring", "background"],
  ["ring", "card"],
];

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("%s theme tokens", (_name, theme) => {
  it.each(TEXT_PAIRS)("%s on %s ≥ 4.5:1", (fg, bg) => {
    expect(contrastRatio(resolveToken(theme, fg), resolveToken(theme, bg))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it.each(UI_PAIRS)("%s on %s ≥ 3:1", (fg, bg) => {
    expect(contrastRatio(resolveToken(theme, fg), resolveToken(theme, bg))).toBeGreaterThanOrEqual(
      3,
    );
  });
});

describe("dark theme background", () => {
  it("is near-black but never pure black (ADR-009)", () => {
    const [l] = resolveToken(dark, "background")
      .match(/[\d.]+/g)!
      .map(Number);
    expect(l).toBeGreaterThan(0.12);
    expect(l).toBeLessThan(0.2);
  });
});

describe("brand (ADR-009 v2)", () => {
  it("uses the client's navy #010080 as the light primary", () => {
    expect(resolveToken(light, "primary")).toBe("oklch(0.272 0.188 264.4)");
    expect(resolveToken(light, "brand")).toBe(resolveToken(light, "primary"));
  });

  it("keeps white text ≥ 7:1 on every stop of the brand surface", () => {
    const start = css.indexOf("@utility bg-brand {");
    const body = css.slice(start, css.indexOf("\n}", start));
    const stops = [...body.matchAll(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)/g)].map(
      (m) => `oklch(${m[1]} ${m[2]} ${m[3]})`,
    );
    const white = "oklch(0.99 0.005 265)";
    expect(stops.length).toBeGreaterThanOrEqual(3);
    for (const stop of stops.filter((s) => s !== white)) {
      expect(contrastRatio(white, stop), stop).toBeGreaterThanOrEqual(7);
    }
  });
});
