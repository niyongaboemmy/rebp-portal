import { Figtree, JetBrains_Mono } from "next/font/google";

/**
 * Type system (ADR-009; self-hosted and subset by next/font — no runtime request to Google, NFR-PERF-005):
 * - Figtree (variable): one family for UI, body and headings — calm, highly legible on low-end phones.
 * - JetBrains Mono: reference, licence and verification codes, where 0/O and 1/l must be distinct.
 * Both include Latin Extended, covering French and Kinyarwanda.
 */
export const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "600"],
});
