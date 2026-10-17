"use client";

import { useEffect } from "react";

/**
 * "Next here" (UX-020): a pulsing dot beside the first visible answer still open on the page —
 * a cue to where the eye should go, without a word. It moves as answers are given and leaves when
 * the page is complete. Drawn in CSS (`[data-next-field]`); reduced motion keeps it still.
 */
export function NextFieldMarker({ issues }: { issues: Record<string, string> }) {
  const key = Object.keys(issues).join("|");
  useEffect(() => {
    const open = new Set(key ? key.split("|") : []);
    const id = requestAnimationFrame(() => {
      document
        .querySelectorAll("[data-next-field]")
        .forEach((el) => el.removeAttribute("data-next-field"));
      const next = [...document.querySelectorAll<HTMLElement>("[data-path]")].find(
        (el) =>
          open.has(el.dataset.path ?? "") &&
          // On the page being shown, outside dialogs, and not nested in another answer.
          el.offsetParent !== null &&
          !el.closest("[role=dialog]") &&
          !el.parentElement?.closest("[data-path]"),
      );
      next?.setAttribute("data-next-field", "");
    });
    return () => cancelAnimationFrame(id);
  });
  useEffect(
    () => () =>
      document
        .querySelectorAll("[data-next-field]")
        .forEach((el) => el.removeAttribute("data-next-field")),
    [],
  );
  return null;
}
