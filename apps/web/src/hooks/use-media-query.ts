"use client";

import { useSyncExternalStore } from "react";

/** Subscribes to a CSS media query. Returns `false` during SSR. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Matches Tailwind's `lg` breakpoint (64rem). */
export const useIsDesktop = () => useMediaQuery("(min-width: 64rem)");
