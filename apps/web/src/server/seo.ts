import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { LOCALES } from "@/i18n/config";
import { LOCALE_PREFIX_HEADER, localisedPath } from "@/i18n/routing";

/** Absolute site origin for canonical URLs, sitemaps and JSON-LD. */
export function siteUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** hreflang map for a public path: one URL per language plus the negotiated x-default (ADR-010). */
export function languageAlternates(path: string): Record<string, string> {
  const base = siteUrl();
  const languages: Record<string, string> = { "x-default": `${base}${path}` };
  for (const locale of LOCALES) languages[locale] = `${base}${localisedPath(locale, path)}`;
  return languages;
}

const OG_LOCALES = { en: "en_GB", rw: "rw_RW", fr: "fr_FR" } as const;

/**
 * Metadata for an indexable public page: title, description, canonical (the URL actually
 * requested — prefixed or negotiated), hreflang alternates and Open Graph.
 */
export async function publicPageMetadata({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}): Promise<Metadata> {
  const [prefix, locale] = await Promise.all([
    headers().then((h) => h.get(LOCALE_PREFIX_HEADER) ?? ""),
    getLocale(),
  ]);
  const canonical = prefix ? (path === "/" ? prefix : `${prefix}${path}`) : path;
  return {
    title,
    description,
    alternates: { canonical, languages: languageAlternates(path) },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      locale: OG_LOCALES[locale as keyof typeof OG_LOCALES] ?? "en_GB",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Authenticated and transactional pages are never indexed. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };
