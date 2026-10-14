import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/i18n/config";
import {
  LOCALE_HEADER,
  LOCALE_PREFIX_HEADER,
  isLocalisedPublicPath,
  splitLocalePrefix,
} from "@/i18n/routing";

/**
 * Optimistic route protection: redirect early when no session cookie exists.
 * Authoritative checks (validity, verification, MFA, roles) happen in server guards.
 *
 * Also resolves locale-prefixed public URLs (`/fr/register` → `/register` in French, ADR-010).
 */
const PROTECTED_PREFIXES = ["/dashboard", "/applications", "/settings", "/backoffice", "/verify"];
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Router or browser prefetches (Next.js header, Fetch `Sec-Purpose`, legacy `Purpose`). */
export function isPrefetch(request: NextRequest): boolean {
  const h = request.headers;
  return (
    h.has("next-router-prefetch") ||
    /prefetch/i.test(h.get("sec-purpose") ?? "") ||
    /prefetch/i.test(h.get("purpose") ?? "")
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);

  const { locale, path } = splitLocalePrefix(pathname);
  if (locale) {
    // Only public pages are localised by URL; anything else drops the prefix.
    if (!isLocalisedPublicPath(path)) {
      return NextResponse.redirect(new URL(path + search, request.url));
    }
    headers.set(LOCALE_HEADER, locale);
    headers.set(LOCALE_PREFIX_HEADER, `/${locale}`);
    headers.set("x-pathname", path + search);
    const url = request.nextUrl.clone();
    url.pathname = path;
    const response = NextResponse.rewrite(url, { request: { headers } });
    // Visiting a language URL is a language choice: remember it (UX-003). A prefetch is not a
    // visit — Next prefetches links as they scroll into view, which must never switch language.
    if (!isPrefetch(request)) {
      response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    }
    return response;
  }

  headers.set("x-pathname", pathname + search);
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const hasSession =
    request.cookies.has("rebp_session") || request.cookies.has("__Host-rebp_session");
  if (isProtected && !hasSession) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|opengraph-image|pwa-icon|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?|xml|txt|js)$).*)",
  ],
};
