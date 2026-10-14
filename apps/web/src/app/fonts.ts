import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";

/**
 * Type system (self-hosted and subset by next/font — no runtime request to Google, NFR-PERF-005):
 * - Figtree: warm geometric sans for body and UI; very legible at small sizes on low-end phones.
 * - Bricolage Grotesque: characterful, friendly display face for headings (variable, optical sizing).
 * - JetBrains Mono: reference, licence and verification codes, where 0/O and 1/l must be distinct.
 * All three include Latin Extended, covering French and Kinyarwanda.
 */
export const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
  display: "swap",
});

export const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
  display: "swap",
  axes: ["opsz"],
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "600"],
});
