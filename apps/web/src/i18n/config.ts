/** UX-003: English, Kinyarwanda, French. EN is complete; RW/FR are machine drafts pending approval. */
export const LOCALES = ["en", "rw", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_LABELS: Record<Locale, { label: string; native: string; approved: boolean }> = {
  en: { label: "English", native: "English", approved: true },
  rw: { label: "Kinyarwanda", native: "Ikinyarwanda", approved: false },
  fr: { label: "French", native: "Français", approved: false },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
