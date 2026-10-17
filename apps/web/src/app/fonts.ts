import { JetBrains_Mono, Quicksand } from "next/font/google";

/**
 * Type system (ADR-009 amendment v14; self-hosted and subset by next/font — no runtime request to
 * Google, NFR-PERF-005):
 * - Quicksand (variable, 300–700): one family for UI, body and headings. Rounded geometric shapes
 *   with soft, airy strokes — smooth and friendly without being childish. Headings sit at a medium
 *   500 and text at 400, so nothing reads heavy.
 * - JetBrains Mono: reference, licence and verification codes, where 0/O and 1/l must be distinct.
 * Both include Latin Extended, covering French and Kinyarwanda.
 */
export const quicksand = Quicksand({
  subsets: ["latin", "latin-ext"],
  variable: "--font-quicksand",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "600"],
});
