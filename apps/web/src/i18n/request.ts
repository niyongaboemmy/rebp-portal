import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale, type Locale } from "./config";
import { loadMessages } from "./messages";
import { LOCALE_HEADER } from "./routing";

/**
 * A locale-prefixed URL wins (ADR-010), then the cookie (explicit choice, remembered per UX-003),
 * then Accept-Language, then English.
 */
async function detectLocale(): Promise<Locale> {
  const fromUrl = (await headers()).get(LOCALE_HEADER);
  if (isLocale(fromUrl)) return fromUrl;
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
    if (tag && (LOCALES as readonly string[]).includes(tag)) return tag as Locale;
  }
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  return {
    locale,
    messages: loadMessages(locale),
    timeZone: "Africa/Kigali",
  };
});
