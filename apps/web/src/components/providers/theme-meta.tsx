"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/** Matches --background in globals.css (keep in sync; the tokens test checks the values). */
export const THEME_COLORS = { light: "#f4f6fa", dark: "#0c0e15" } as const;

/**
 * Keeps the browser chrome (address bar, PWA title bar) in step with the theme the person picked,
 * not just the OS setting: the static <meta name="theme-color"> tags only follow
 * prefers-color-scheme, so a manual "Dark" on a light-mode phone would leave the bar light.
 */
export function ThemeMeta() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = THEME_COLORS[resolvedTheme];
    }
  }, [resolvedTheme]);
  return null;
}
