/**
 * OKLCH → sRGB conversion and WCAG 2.2 contrast (UX-002). Used by the token contrast test so
 * every documented foreground/background pair in `globals.css` is verified, not eyeballed.
 */

export type Rgb = [number, number, number];

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.]+%?\s*)?\)$/;

export function parseOklch(value: string): [number, number, number] | null {
  const match = OKLCH.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Linear-light sRGB, clamped to gamut. */
export function oklchToLinearRgb(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const fg = parseOklch(foreground);
  const bg = parseOklch(background);
  if (!fg || !bg) throw new Error(`Not an oklch() colour: ${foreground} / ${background}`);
  const a = relativeLuminance(oklchToLinearRgb(...fg));
  const b = relativeLuminance(oklchToLinearRgb(...bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
