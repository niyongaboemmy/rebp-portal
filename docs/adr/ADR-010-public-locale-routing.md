# ADR-010 — Locale-prefixed URLs for public pages

**Status:** Proposed (implemented on `feat/ui-modernization`) · **Amends:** ADR-008 (cookie-only locale) ·
**Refs:** UX-003, FR-REG-008

**Problem.** With the locale chosen only by cookie, one URL serves three languages; search engines index one
and hreflang is impossible.

**Decision.** Public pages (`/`, `/register`, `/check/*`, `/categories`, `/eligibility`, `/privacy`) are also
served at `/en/…`, `/rw/…` and `/fr/…`. `proxy.ts` strips the prefix, passes the locale in a request header
(`x-locale`, read first by `i18n/request.ts`) and stores it in the locale cookie, since an explicit language URL
is a language choice. The unprefixed URL stays cookie/Accept-Language negotiated and is the hreflang
`x-default`. Each public page's metadata (`publicPageMetadata`) emits a self-canonical URL plus `en`, `rw`,
`fr` and `x-default` alternates, and `sitemap.ts` lists the same. Authenticated areas keep cookie-only locale
and are `noindex`. A prefixed non-public path redirects to the unprefixed path.

**Trade-off.** Internal links stay unprefixed; after visiting `/fr/…` the cookie keeps the site in French.
Practitioner pages, when added, follow the same pattern and respect the opt-out (FR-REG-008) and anti-scraping
limits (FR-REG-005).
