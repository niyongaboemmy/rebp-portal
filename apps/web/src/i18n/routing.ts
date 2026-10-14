import { LOCALES, type Locale } from "./config";

/**
 * ADR-010: public pages are reachable at a negotiated URL (`/register`, the hreflang x-default)
 * and at one explicit URL per language (`/en/register`, `/rw/register`, `/fr/register`) so search
 * engines can index every language. The proxy strips the prefix and passes the locale on.
 */
export const LOCALE_HEADER = "x-locale";
export const LOCALE_PREFIX_HEADER = "x-locale-prefix";

/** Paths that may carry a locale prefix (exact, or as a parent of the path). */
export const LOCALISED_PUBLIC_PATHS = [
  "/",
  "/register",
  "/categories",
  "/eligibility",
  "/check",
  "/privacy",
] as const;

const PREFIX = new RegExp(`^/(${LOCALES.join("|")})(?=/|$)`);

export function splitLocalePrefix(pathname: string): { locale: Locale | null; path: string } {
  const match = PREFIX.exec(pathname);
  if (!match) return { locale: null, path: pathname };
  return { locale: match[1] as Locale, path: pathname.slice(match[0].length) || "/" };
}

export function isLocalisedPublicPath(path: string): boolean {
  return LOCALISED_PUBLIC_PATHS.some((p) =>
    p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`),
  );
}

export function localisedPath(locale: Locale, path: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
