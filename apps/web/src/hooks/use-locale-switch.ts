"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { localisedPath, splitLocalePrefix } from "@/i18n/routing";
import { setLocaleAction } from "@/server/actions/auth";

/**
 * Switches the UI language (UX-003). On a language URL (`/fr/register`, ADR-010) it moves to
 * the same page in the new language; elsewhere it stores the choice and re-renders, with a
 * full reload as a fallback if the page has not switched shortly after.
 */
export function useLocaleSwitch() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchTo = (next: string) => {
    if (!isLocale(next) || next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      const { locale: prefixed, path } = splitLocalePrefix(window.location.pathname);
      if (prefixed) {
        router.replace(`${localisedPath(next, path)}${window.location.search}` as never);
      } else {
        router.refresh();
      }
      // Safety net: if the soft refresh did not re-render in the new language (a stale client
      // cache or dev bundle), fall back to a full reload so the switch always lands.
      window.setTimeout(() => {
        if (document.documentElement.lang !== next) window.location.reload();
      }, 2500);
    });
  };

  return { locale, switchTo, pending };
}
